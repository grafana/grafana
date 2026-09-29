import { CodeLanguage, TextMode } from '../panelcfg.gen';

import { getCodeMirrorLanguage, getInterpolateFormat, transformContent } from './utils';

describe('transformContent', () => {
  describe('never returns an empty string', () => {
    // DangerouslySetHtmlContent throws on falsy html, so any of these would
    // crash the panel.
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
  // code.language survives switching out of code mode, so it must not decide the format on its own.
  const cases: Array<[TextMode, CodeLanguage | undefined, string]> = [
    [TextMode.Code, CodeLanguage.Json, 'json'],
    [TextMode.Code, CodeLanguage.Yaml, 'raw'],
    [TextMode.Code, CodeLanguage.Plaintext, 'raw'],
    [TextMode.Code, undefined, 'raw'],
    [TextMode.Markdown, CodeLanguage.Json, 'html'],
    [TextMode.Markdown, undefined, 'html'],
    [TextMode.HTML, CodeLanguage.Json, 'html'],
    [TextMode.HTML, undefined, 'html'],
  ];

  it.each(cases)('formats %s mode with the %s language as %s', (mode, codeLanguage, expected) => {
    expect(getInterpolateFormat(mode, codeLanguage)).toBe(expected);
  });
});

describe('getCodeMirrorLanguage', () => {
  // An unmapped language silently loses syntax highlighting.
  it.each([
    [CodeLanguage.Go, 'go'],
    [CodeLanguage.Html, 'html'],
    [CodeLanguage.Json, 'json'],
    [CodeLanguage.Markdown, 'markdown'],
    [CodeLanguage.Sql, 'sql'],
    [CodeLanguage.Typescript, 'typescript'],
    [CodeLanguage.Xml, 'xml'],
    [CodeLanguage.Yaml, 'yaml'],
  ])('maps %s to %s', (codeLanguage, expected) => {
    expect(getCodeMirrorLanguage(codeLanguage)).toBe(expected);
  });

  it('has no language for plaintext or an unset language', () => {
    expect(getCodeMirrorLanguage(CodeLanguage.Plaintext)).toBeUndefined();
    expect(getCodeMirrorLanguage(undefined)).toBeUndefined();
  });

  it('covers every CodeLanguage option', () => {
    const unmapped = Object.values(CodeLanguage).filter(
      (codeLanguage) => codeLanguage !== CodeLanguage.Plaintext && !getCodeMirrorLanguage(codeLanguage)
    );

    expect(unmapped).toEqual([]);
  });
});
