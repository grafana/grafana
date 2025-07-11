import { sanitizeTextPanelContent, sanitizeUrl, sanitize, validatePath, PathValidationError } from './sanitize';

describe('sanitizeTextPanelContent', () => {
  it('should allow whitelisted styles in text panel', () => {
    const html =
      '<div style="display:flex; flex-direction: column; flex-wrap: wrap; justify-content: start; gap: 2px;"><div style="flex-basis: 50%"></div></div>';
    const str = sanitizeTextPanelContent(html);
    expect(str).toBe(
      '<div style="display:flex; flex-direction:column; flex-wrap:wrap; justify-content:start; gap:2px;"><div style="flex-basis:50%;"></div></div>'
    );
  });

  it('should escape xss payload', () => {
    const html = '<script>alert(1)</script>';
    const str = sanitizeTextPanelContent(html);
    expect(str).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('should allow markdown generated unstyled disabled checkbox inputs', () => {
    const str = sanitizeTextPanelContent(`<input disabled="" type="checkbox">
<input checked="" disabled="" type="checkbox">`);
    expect(str).toMatch(/<input disabled(="")? type="checkbox">/);
    expect(str).toMatch(/<input checked(="")? disabled(="")? type="checkbox">/);
  });

  it('should sanitize arbitrary input elements', () => {
    const str = sanitizeTextPanelContent(`<input>
        <input type="text">
        <input disabled="" type="radio">
        <input disabled="" type="checkbox" class="some-class">
        <input checked="" disabled="" type="checkbox" class="some-class">`);
    expect(str).not.toMatch(/<input/);
  });
});

describe('sanitizeUrl', () => {
  it('sanitize javascript urls', () => {
    const url = 'javascript:alert(document.domain)';
    const str = sanitizeUrl(url);
    expect(str).toBe('about:blank');
  });
});

describe('sanitizeIframe', () => {
  it('should sanitize iframe tags', () => {
    const html = '<iframe src="javascript:alert(document.domain)"></iframe>';
    const str = sanitizeTextPanelContent(html);
    expect(str).toBe('<iframe src="about:blank" sandbox credentialless referrerpolicy=no-referrer></iframe>');
  });
});

describe('sanitize', () => {
  it('should sanitize xss payload', () => {
    const html = '<script>alert(1)</script>';
    const str = sanitize(html);
    expect(str).toBe('');
  });

  describe('should sanitize anchors with target="_blank"', () => {
    it('should add rel="noopener noreferrer" to target="_blank" links', () => {
      const html = '<a href="https://example.com" target="_blank">Link</a>';
      const str = sanitize(html);
      expect(str).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>');
    });

    it('should preserve existing rel attributes and add noopener noreferrer, if not already added', () => {
      const html = '<a href="https://example.com" target="_blank" rel="external noreferrer">Link</a>';
      const str = sanitize(html);
      expect(str).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>');
    });

    it('should not modify links without target="_blank"', () => {
      const html = '<a href="https://example.com">Link</a>';
      const str = sanitize(html);
      expect(str).toBe('<a href="https://example.com">Link</a>');
    });
  });
});

describe('validatePath', () => {
  describe('path traversal protection', () => {
    it('should block simple path traversal attempts', () => {
      expect(() => validatePath('/api/../admin')).toThrow(PathValidationError);
      expect(() => validatePath('api/../admin')).toThrow(PathValidationError);
      expect(() => validatePath('../admin')).toThrow(PathValidationError);
    });

    it('should block URL encoded path traversal attempts', () => {
      expect(() => validatePath('/api/%2e%2e/admin')).toThrow(PathValidationError);
      expect(() => validatePath('/api/%252e%252e/admin')).toThrow(PathValidationError);
    });

    it('should block double encoded traversal attempts', () => {
      expect(() => validatePath('/api/%252e%252e/admin')).toThrow(PathValidationError);
    });

    it('should handle malformed URI encoding gracefully', () => {
      expect(() => validatePath('/api/%/admin')).toThrow(PathValidationError);
      expect(() => validatePath('/api/%2/admin')).toThrow(PathValidationError);
    });

    it('should block paths with tab characters', () => {
      expect(() => validatePath('/api/\tadmin')).toThrow(PathValidationError);
      expect(() => validatePath('/api/users\t/123')).toThrow(PathValidationError);
    });

    it('should block paths with newline characters', () => {
      expect(() => validatePath('/api/\nadmin')).toThrow(PathValidationError);
      expect(() => validatePath('/api/users\n/123')).toThrow(PathValidationError);
    });

    it('should block paths with carriage return characters', () => {
      expect(() => validatePath('/api/\radmin')).toThrow(PathValidationError);
      expect(() => validatePath('/api/users\r/123')).toThrow(PathValidationError);
    });

    it('should block URL encoded tab and newline characters', () => {
      expect(() => validatePath('/api/%09admin')).toThrow(PathValidationError); // tab
      expect(() => validatePath('/api/%0Aadmin')).toThrow(PathValidationError); // newline
      expect(() => validatePath('/api/%0Dadmin')).toThrow(PathValidationError); // carriage return
    });
  });

  describe('safe paths', () => {
    it('should preserve safe paths', () => {
      expect(validatePath('/api/users/123')).toBe('/api/users/123');
      expect(validatePath('/api/dashboard/save')).toBe('/api/dashboard/save');
      expect(validatePath('api/config')).toBe('api/config');
    });

    it('should preserve paths with file extensions', () => {
      expect(validatePath('/api/file.json')).toBe('/api/file.json');
      expect(validatePath('/static/image.png')).toBe('/static/image.png');
    });

    it('should preserve paths with query parameters', () => {
      expect(validatePath('/api/search?q=test')).toBe('/api/search?q=test');
      expect(validatePath('/api/file.json?version=1.2.3&format=compact')).toBe(
        '/api/file.json?version=1.2.3&format=compact'
      );
    });

    it('should handle empty and root paths', () => {
      expect(validatePath('')).toBe('');
      expect(validatePath('/')).toBe('/');
    });
  });

  describe('full URL handling', () => {
    it('should preserve safe full URLs', () => {
      const safeUrl = 'https://api.example.com/users/123';
      expect(validatePath(safeUrl)).toBe(safeUrl);
    });

    it('should preserve URLs with query parameters and fragments', () => {
      const urlWithQuery = 'https://api.example.com/search?q=test&limit=10#results';
      expect(validatePath(urlWithQuery)).toBe(urlWithQuery);
    });

    it('should block traversal in URL paths while preserving query params', () => {
      expect(() => validatePath('https://api.example.com/api/../admin?token=abc')).toThrow(PathValidationError);
      expect(() => validatePath('http://localhost:3000/api/%2e%2e/secrets?param=value')).toThrow(PathValidationError);
    });

    it('should allow legitimate dots in URL paths with query params', () => {
      const urlWithDots = 'https://cdn.example.com/files/document.v1.2.pdf?download=true';
      expect(validatePath(urlWithDots)).toBe(urlWithDots);
    });

    it('should allow query parameters that contain dots', () => {
      const urlWithDotsInQuery = 'https://api.example.com/search?version=1.2.3&file=../config';
      expect(validatePath(urlWithDotsInQuery)).toBe(urlWithDotsInQuery);
    });

    it('should handle malformed URLs gracefully', () => {
      expect(() => validatePath('not-a-url://../admin')).toThrow(PathValidationError);
      expect(validatePath('://malformed')).toBe('://malformed'); // No traversal attempt, so it's allowed
    });

    it('should handle URLs with different protocols', () => {
      expect(validatePath('ftp://files.example.com/safe/path')).toBe('ftp://files.example.com/safe/path');
      expect(() => validatePath('ftp://files.example.com/../secrets')).toThrow(PathValidationError);
    });

    it('should handle URLs with backslashes', () => {
      expect(() => validatePath('https://api.example.com/\\example.com')).toThrow(PathValidationError);
    });

    it('should handle URLs with backslashes and dots in the path', () => {
      expect(() => validatePath('https://api.example.com/\\..\\/admin')).toThrow(PathValidationError);
    });
  });
});
