import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import { config } from '@grafana/runtime';

describe('__theme', () => {
  const templateSrv = initTemplateSrv('theme', []);
  const originalTheme = config.theme2;

  afterEach(() => {
    config.theme2 = originalTheme;
  });

  it('resolves a theme token path to its value', () => {
    expect(templateSrv.replace('color: ${__theme.colors.text.primary}')).toBe(
      `color: ${config.theme2.colors.text.primary}`
    );
  });

  it('resolves a number token to its string form', () => {
    expect(templateSrv.replace('${__theme.typography.fontSize}px')).toBe('14px');
  });

  it('applies the requested format to the token', () => {
    expect(templateSrv.replace('${__theme.typography.fontFamilyMonospace:html}')).toBe(
      '&#39;Roboto Mono&#39;, monospace'
    );
  });

  it.each([
    { desc: 'no path', target: '${__theme}' },
    { desc: 'an object', target: '${__theme.colors.text}' },
    { desc: 'a function', target: '${__theme.spacing}' },
    { desc: 'a missing path', target: '${__theme.colors.nope}' },
  ])('leaves $desc unresolved', ({ target }) => {
    expect(templateSrv.replace(target)).toBe(target);
  });

  it('reads the theme current at interpolation time', () => {
    config.theme2 = {
      ...originalTheme,
      colors: { ...originalTheme.colors, text: { ...originalTheme.colors.text, primary: 'red' } },
    };

    expect(templateSrv.replace('${__theme.colors.text.primary}')).toBe('red');
  });
});
