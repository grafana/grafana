import { sanitizeTextPanelContent, sanitizeUrl, sanitize } from './sanitize';

describe('Sanitize wrapper', () => {
  it('should allow whitelisted styles in text panel', () => {
    const html =
      '<div style="display:flex; flex-direction: column; flex-wrap: wrap; justify-content: start; gap: 2px;"><div style="flex-basis: 50%"></div></div>';
    const str = sanitizeTextPanelContent(html);
    expect(str).toBe(
      '<div style="display:flex; flex-direction:column; flex-wrap:wrap; justify-content:start; gap:2px;"><div style="flex-basis:50%;"></div></div>'
    );
  });
});

describe('sanitizeUrl', () => {
  it('sanitize javascript urls', () => {
    const url = 'javascript:alert(document.domain)';
    const str = sanitizeUrl(url);
    expect(str).toBe('about:blank');
  });
});

// write test to sanitize xss payloads using the sanitize function
describe('sanitize', () => {
  it('should sanitize xss payload', () => {
    const html = '<script>alert(1)</script>';
    const str = sanitize(html);
    expect(str).toBe('');
  });
});
