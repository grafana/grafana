import { getThemeById } from '@grafana/data';

import { applyDocumentLanguage, withLocaleTypography } from './appLocale';

describe('applyDocumentLanguage', () => {
  const { lang, dir } = document.documentElement;

  afterEach(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  });

  it('sets RTL for Persian and restores LTR for English', () => {
    applyDocumentLanguage('fa-IR');
    expect(document.documentElement.lang).toBe('fa-IR');
    expect(document.documentElement.dir).toBe('rtl');

    applyDocumentLanguage('en-US');
    expect(document.documentElement.lang).toBe('en-US');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

describe('withLocaleTypography', () => {
  it('selects the Persian font for text and preserves monospace code', () => {
    const theme = getThemeById('light');
    const persian = withLocaleTypography(theme, 'fa-IR');

    expect(persian.typography.fontFamily).toMatch(/^Vazirmatn, /);
    expect(persian.typography.body.fontFamily).toMatch(/^Vazirmatn, /);
    expect(persian.v1.typography.fontFamily.sansSerif).toBe(persian.typography.fontFamily);
    expect(persian.typography.code).toBe(theme.typography.code);
    expect(withLocaleTypography(persian, 'fa-IR')).toBe(persian);
    expect(withLocaleTypography(theme, 'en-US')).toBe(theme);
  });
});
