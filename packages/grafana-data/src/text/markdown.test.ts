import { renderMarkdown, renderTextPanelMarkdown } from './markdown';

describe.each([renderMarkdown, renderTextPanelMarkdown])('Markdown admonitions (%p)', (render) => {
  it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])('renders %s with a readable fallback', (kind) => {
    const html = render(`> [!${kind}]\n> **Read** [more](https://grafana.com).\n>\n> - First\n> - Second`);
    expect(html).toContain(`class="grafana-markdown-alert-${kind.toLowerCase()}"`);
    expect(html).toContain('<strong>Read</strong>');
    expect(html).toContain('<a href="https://grafana.com">more</a>');
    expect(html).toContain('<li>Second</li>');
    expect(html).not.toContain(`[!${kind}]`);
  });

  it.each([
    '> Normal quote',
    '> [!UNKNOWN]\n> Text',
    '> Before [!NOTE]\n> Text',
    '> [!NOTE] custom title\n> Text',
    '> \\[!NOTE]\n> Text',
    '```md\n> [!NOTE]\n> Text\n```',
  ])('leaves non-admonitions unchanged: %s', (markdown) => {
    expect(render(markdown)).not.toContain('grafana-markdown-alert-');
  });

  it('supports nested block content and empty alerts', () => {
    expect(render('> [!NOTE]\n>\n> > [!TIP]\n> > Nested')).toContain('grafana-markdown-alert-tip');
    expect(render('> [!NOTE]')).toContain('<div class="grafana-markdown-alert-body"></div>');
  });

  it('preserves reference links defined outside the alert', () => {
    expect(render('> [!NOTE]\n> [Docs][docs]\n\n[docs]: https://grafana.com')).toContain(
      '<a href="https://grafana.com">Docs</a>'
    );
  });

  it('sanitizes alert bodies with the existing policy', () => {
    const html = render('> [!WARNING]\n> <img src="x" onerror="alert(1)"><script>alert(2)</script>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('Markdown wrapper', () => {
  it('removes the marker line break while retaining body line breaks', () => {
    expect(renderMarkdown('> [!NOTE]\n> First\n> Second', { breaks: true })).toContain('<p>First<br>Second</p>');
    expect(renderMarkdown('> [!NOTE]  \n> Body')).toContain('<p>Body</p>');
  });
  it('should be able to handle undefined value', () => {
    const str = renderMarkdown(undefined);
    expect(str).toBe('');
  });

  it('should sanitize by default', () => {
    const str = renderMarkdown('<script>alert()</script>');
    expect(str).toBe('&lt;script&gt;alert()&lt;/script&gt;');
  });

  it('should only escape (and not remove) code blocks inside markdown', () => {
    const inlineCodeBlock = renderMarkdown('This is a piece of code block: `<script>alert()</script>`');
    expect(inlineCodeBlock.trim()).toBe(
      '<p>This is a piece of code block: <code>&lt;script&gt;alert()&lt;/script&gt;</code></p>'
    );

    const multilineCodeBlock = renderMarkdown('This is a piece of code block: ```<script>alert()</script>```');
    expect(multilineCodeBlock.trim()).toBe(
      '<p>This is a piece of code block: <code>&lt;script&gt;alert()&lt;/script&gt;</code></p>'
    );
  });

  it('should allow markdown todo checkbox inputs', () => {
    const str = renderTextPanelMarkdown(`- [ ] unchecked
- [x] checked`);
    expect(str).toMatch(/<input disabled(="")? type="checkbox">/);
    expect(str).toMatch(/<input checked(="")? disabled(="")? type="checkbox">/);
  });

  it('should sanitize arbitrary input elements', () => {
    const str = renderTextPanelMarkdown(`<input>
      <input type="text">
      <input disabled="" type="radio">
      <input disabled="" type="checkbox" class="some-class">
      <input checked="" disabled="" type="checkbox" class="some-class">`);
    expect(str).not.toMatch(/<input/);
  });

  it('should sanitize content in text panel by default', () => {
    const str = renderTextPanelMarkdown('<script>alert()</script>');
    expect(str).toBe('&lt;script&gt;alert()&lt;/script&gt;');
  });
});
