import { renderMarkdown, renderTextPanelMarkdown } from './markdown';

describe('Markdown wrapper', () => {
  it('should be able to handle undefined value', () => {
    const str = renderMarkdown(undefined);
    expect(str).toBe('');
  });

  it('should sanitize by default', () => {
    const str = renderMarkdown('<script>alert()</script>');
    expect(str).toBe('&lt;script&gt;alert()&lt;/script&gt;');
  });

  it('should sanitize content in text panel by default', () => {
    const str = renderTextPanelMarkdown('<script>alert()</script>');
    expect(str).toBe('&lt;script&gt;alert()&lt;/script&gt;');
  });
});
