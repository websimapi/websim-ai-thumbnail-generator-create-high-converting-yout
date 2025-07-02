class ThumbnailGenerator {
    constructor() {
        this.form = document.getElementById('thumbnailForm');
        this.generateBtn = document.getElementById('generateBtn');
        this.resultsContainer = document.getElementById('thumbnailResults');
        this.analysisContainer = document.getElementById('analysisResults');
        this.conversationHistory = [];
        
        this.init();
    }
    
    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.setupFileUpload();
    }
    
    setupFileUpload() {
        const fileInput = document.getElementById('referenceImage');
        const uploadArea = document.querySelector('.file-upload-area');
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                uploadArea.querySelector('.upload-text').textContent = file.name;
                uploadArea.style.borderColor = 'var(--success)';
                uploadArea.style.background = 'rgba(16, 185, 129, 0.1)';
            }
        });
        
        // Drag and drop functionality
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary)';
            uploadArea.style.background = 'rgba(99, 102, 241, 0.1)';
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--border)';
            uploadArea.style.background = 'transparent';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        this.setLoading(true);
        
        try {
            const formData = this.getFormData();
            
            // Generate AI analysis first
            const analysis = await this.generateAnalysis(formData);
            
            // Generate thumbnails based on analysis
            const thumbnails = await this.generateThumbnails(formData, analysis);
            
            this.displayResults(thumbnails, analysis);
            
        } catch (error) {
            console.error('Error generating thumbnails:', error);
            this.showError('Failed to generate thumbnails. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }
    
    getFormData() {
        const formData = new FormData(this.form);
        const styles = Array.from(document.querySelectorAll('input[name="styles"]:checked'))
            .map(input => input.value);
        
        return {
            title: formData.get('videoTitle') || document.getElementById('videoTitle').value,
            description: formData.get('videoDescription') || document.getElementById('videoDescription').value,
            category: formData.get('videoCategory') || document.getElementById('videoCategory').value,
            targetAudience: formData.get('targetAudience') || document.getElementById('targetAudience').value,
            styles: styles,
            referenceImage: document.getElementById('referenceImage').files[0]
        };
    }
    
    async generateAnalysis(formData) {
        const analysisPrompt = `Analyze this YouTube video concept and provide thumbnail optimization recommendations:

Title: "${formData.title}"
Description: "${formData.description}"
Category: ${formData.category}
Target Audience: ${formData.targetAudience}
Selected Styles: ${formData.styles.join(', ')}

Provide specific recommendations for:
1. Color scheme that drives clicks for this category
2. Emotional expressions that work best
3. Text placement and typography
4. Visual elements that should be included
5. A/B testing suggestions

Respond with actionable insights in a concise format.`;

        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert YouTube thumbnail analyst with deep knowledge of what makes thumbnails get high click-through rates. Provide specific, actionable recommendations."
                },
                {
                    role: "user",
                    content: analysisPrompt
                }
            ]
        });

        return completion.content;
    }
    
    async generateThumbnails(formData, analysis) {
        const thumbnails = [];
        
        // Generate different style variations
        const stylePrompts = this.createStylePrompts(formData, analysis);
        
        for (let i = 0; i < stylePrompts.length; i++) {
            try {
                const result = await websim.imageGen({
                    prompt: stylePrompts[i].prompt,
                    aspect_ratio: "16:9",
                    seed: Math.floor(Math.random() * 1000)
                });
                
                thumbnails.push({
                    url: result.url,
                    style: stylePrompts[i].style,
                    title: stylePrompts[i].title,
                    description: stylePrompts[i].description
                });
            } catch (error) {
                console.error(`Failed to generate thumbnail ${i + 1}:`, error);
            }
        }
        
        return thumbnails;
    }
    
    createStylePrompts(formData, analysis) {
        const baseElements = {
            title: formData.title,
            category: formData.category,
            audience: formData.targetAudience
        };
        
        const prompts = [];
        
        // Generate prompts for each selected style
        formData.styles.forEach(style => {
            let prompt = this.getStylePrompt(style, baseElements);
            
            prompts.push({
                style: style,
                prompt: prompt,
                title: `${style.charAt(0).toUpperCase() + style.slice(1)} Style`,
                description: `High-conversion thumbnail optimized for ${formData.category} content`
            });
        });
        
        // If no styles selected, generate default variations
        if (prompts.length === 0) {
            prompts.push({
                style: 'default',
                prompt: this.getStylePrompt('dramatic', baseElements),
                title: 'AI Optimized',
                description: 'Default high-conversion thumbnail'
            });
        }
        
        return prompts;
    }
    
    getStylePrompt(style, elements) {
        const categoryKeywords = {
            gaming: 'gaming setup, colorful RGB lighting, action-packed',
            education: 'clean educational environment, professional presentation',
            entertainment: 'vibrant colors, excited expressions, dynamic composition',
            lifestyle: 'aesthetic lifestyle imagery, warm lighting, relatable',
            tech: 'modern technology, sleek design, futuristic elements',
            finance: 'professional business environment, charts, money symbols',
            fitness: 'energetic workout setting, fitness equipment, motivation',
            music: 'musical instruments, stage lighting, artistic composition',
            news: 'professional news setting, serious tone, informative',
            other: 'eye-catching visuals, bold composition'
        };
        
        const audienceAdjustments = {
            '13-17': 'youthful energy, trendy aesthetic, social media style',
            '18-24': 'modern lifestyle, relatable content, social awareness',
            '25-34': 'professional quality, lifestyle focused, aspirational',
            '35-44': 'mature presentation, family-friendly, practical focus',
            '45+': 'classic presentation, clear messaging, trustworthy appearance',
            'all': 'universally appealing, clear messaging, broad appeal'
        };
        
        const styleTemplates = {
            dramatic: `Dramatic YouTube thumbnail with intense lighting, shocked facial expression, bright contrasting colors (red, yellow, blue), bold sans-serif text overlay reading "${elements.title}", ${categoryKeywords[elements.category]}, ${audienceAdjustments[elements.audience]}, high contrast, eye-catching composition, professional quality, 16:9 aspect ratio`,
            
            minimal: `Clean minimal YouTube thumbnail with simple composition, subtle colors (white, light blue, soft pastels), elegant typography for "${elements.title}", ${categoryKeywords[elements.category]}, ${audienceAdjustments[elements.audience]}, lots of white space, modern design, professional quality, 16:9 aspect ratio`,
            
            bold: `Bold energetic YouTube thumbnail with vibrant colors (electric blue, hot pink, bright yellow), dynamic action pose, explosive visual effects, large impact font for "${elements.title}", ${categoryKeywords[elements.category]}, ${audienceAdjustments[elements.audience]}, high energy composition, attention-grabbing, 16:9 aspect ratio`,
            
            professional: `Professional YouTube thumbnail with business aesthetic, clean layout, corporate colors (navy, gray, white), professional headshot, sophisticated typography for "${elements.title}", ${categoryKeywords[elements.category]}, ${audienceAdjustments[elements.audience]}, trustworthy appearance, high-end quality, 16:9 aspect ratio`
        };
        
        return styleTemplates[style] || styleTemplates.dramatic;
    }
    
    displayResults(thumbnails, analysis) {
        // Clear placeholder
        this.resultsContainer.innerHTML = '';
        
        if (thumbnails.length === 0) {
            this.showError('No thumbnails could be generated. Please try again.');
            return;
        }
        
        // Create thumbnail grid
        const grid = document.createElement('div');
        grid.className = 'thumbnails-grid';
        grid.style.display = 'grid';
        grid.style.gap = '1rem';
        
        thumbnails.forEach((thumbnail, index) => {
            const thumbnailCard = this.createThumbnailCard(thumbnail, index);
            grid.appendChild(thumbnailCard);
        });
        
        this.resultsContainer.appendChild(grid);
        
        // Show analysis
        this.displayAnalysis(analysis);
    }
    
    createThumbnailCard(thumbnail, index) {
        const card = document.createElement('div');
        card.className = 'thumbnail-result';
        
        card.innerHTML = `
            <img src="${thumbnail.url}" alt="${thumbnail.title}" class="thumbnail-image">
            <div class="thumbnail-overlay">
                <div class="thumbnail-title">${thumbnail.title}</div>
                <div class="thumbnail-actions">
                    <button class="action-btn" onclick="thumbnailGenerator.downloadThumbnail('${thumbnail.url}', 'thumbnail-${index + 1}')">
                        📥
                    </button>
                    <button class="action-btn" onclick="thumbnailGenerator.copyToClipboard('${thumbnail.url}')">
                        📋
                    </button>
                    <button class="action-btn" onclick="thumbnailGenerator.shareThumbnail('${thumbnail.url}')">
                        🔗
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }
    
    displayAnalysis(analysis) {
        const analysisContent = document.getElementById('analysisContent');
        analysisContent.innerHTML = `
            <div class="analysis-content">
                <pre style="white-space: pre-wrap; font-family: inherit; color: var(--text-secondary); line-height: 1.6;">${analysis}</pre>
            </div>
        `;
        
        this.analysisContainer.style.display = 'block';
    }
    
    downloadThumbnail(url, filename) {
        // This approach avoids potential CORS issues with fetch and is more reliable for downloads.
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.png`;
        
        // Append to the document, click, and then remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    async copyToClipboard(url) {
        try {
            await navigator.clipboard.writeText(url);
            this.showSuccess('URL copied to clipboard!');
        } catch (error) {
            console.error('Copy failed:', error);
            this.showError('Copy failed. Please try again.');
        }
    }
    
    shareThumbnail(url) {
        if (navigator.share) {
            navigator.share({
                title: 'AI Generated Thumbnail',
                url: url
            });
        } else {
            this.copyToClipboard(url);
        }
    }
    
    setLoading(loading) {
        this.generateBtn.disabled = loading;
        this.generateBtn.classList.toggle('loading', loading);
        
        if (loading) {
            this.resultsContainer.innerHTML = `
                <div class="placeholder-message">
                    <div class="placeholder-icon">🔄</div>
                    <h3>Generating Thumbnails...</h3>
                    <p>Our AI is analyzing your content and creating high-conversion thumbnails. This may take a moment.</p>
                </div>
            `;
        }
    }
    
    showError(message) {
        this.resultsContainer.innerHTML = `
            <div class="placeholder-message">
                <div class="placeholder-icon">❌</div>
                <h3>Generation Failed</h3>
                <p>${message}</p>
            </div>
        `;
    }
    
    showSuccess(message) {
        // Create temporary success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: var(--success);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 600;
            z-index: 1000;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Initialize the application
const thumbnailGenerator = new ThumbnailGenerator();

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.input-panel, .results-panel, .example-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});