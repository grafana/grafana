import { CodeLanguage, TextMode } from '../../schemas/textng/panelcfg.gen';

import { getInterpolateFormat, transformContent } from './utils';

describe('transformContent', () => {
  describe('never returns an empty string', () => {
    // DangerouslySetHtmlContent throws "html prop can't be null" on any falsy
    // html, so every one of these would crash the panel if it slipped through.
    const rendersToNothing = ['', ' ', '\n', '\n\n', '   \n  ', '<!-- just a comment -->'];

    it.each(rendersToNothing)('for markdown content %j', (content) => {
      expect(transformContent(TextMode.Markdown, content, false)).not.toBe('');
    });

    it.each(rendersToNothing)('for HTML content %j', (content) => {
      expect(transformContent(TextMode.HTML, content, false)).not.toBe('');
    });

    it.each(rendersToNothing)('for code content %j', (content) => {
      expect(transformContent(TextMode.Code, content, false)).not.toBe('');
    });

    it('for markdown that survives sanitization only as empty', () => {
      expect(transformContent(TextMode.Markdown, '<!-- x -->', true)).not.toBe('');
    });
  });

  it('renders markdown', () => {
    expect(transformContent(TextMode.Markdown, '# Title', false)).toContain('<h1');
  });

  it('sanitizes HTML by default', () => {
    const html = transformContent(TextMode.HTML, '<script>alert(1)</script><p>safe</p>', false);

    expect(html).not.toContain('<script>');
    expect(html).toContain('safe');
  });

  it('leaves HTML untouched when sanitization is disabled', () => {
    expect(transformContent(TextMode.HTML, '<form><p>kept</p></form>', true)).toContain('<form>');
  });

  it('leaves code content unrendered', () => {
    expect(transformContent(TextMode.Code, '# not a heading', false)).toBe('# not a heading');
  });
});

describe('getInterpolateFormat', () => {
  it('uses the json format for the json language so values stay valid json', () => {
    expect(getInterpolateFormat(CodeLanguage.Json)).toBe('json');
    expect(getInterpolateFormat(CodeLanguage.Plaintext)).toBe('html');
    expect(getInterpolateFormat(undefined)).toBe('html');
  });
});
