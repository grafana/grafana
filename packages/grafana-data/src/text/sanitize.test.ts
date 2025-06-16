import { sanitizeTextPanelContent, sanitizeUrl, sanitize } from './sanitize';

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
      const str = sanitize(html, true);
      expect(str).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>');
    });

    it('should preserve existing rel attributes and add noopener noreferrer, if not already added', () => {
      const html = '<a href="https://example.com" target="_blank" rel="external noreferrer">Link</a>';
      const str = sanitize(html, true);
      expect(str).toBe('<a href="https://example.com" target="_blank" rel="external noreferrer noopener">Link</a>');
    });

    it('should not modify links without target="_blank"', () => {
      const html = '<a href="https://example.com">Link</a>';
      const str = sanitize(html, true);
      expect(str).toBe('<a href="https://example.com">Link</a>');

      const str2 = sanitize(html);
      expect(str2).toBe('<a href="https://example.com">Link</a>');
    });
  });
});
