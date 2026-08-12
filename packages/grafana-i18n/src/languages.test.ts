import { LANGUAGES } from './languages';

const expectedLanguages = [
  { code: 'en-US', name: 'English' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'es-ES', name: 'Español' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'zh-Hans', name: '中文（简体）' },
  { code: 'pt-BR', name: 'Português Brasileiro' },
  { code: 'zh-Hant', name: '中文（繁體）' },
  { code: 'it-IT', name: 'Italiano' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'id-ID', name: 'Bahasa Indonesia' },
  { code: 'ko-KR', name: '한국어' },
  { code: 'ru-RU', name: 'Русский' },
  { code: 'cs-CZ', name: 'Čeština' },
  { code: 'nl-NL', name: 'Nederlands' },
  { code: 'hu-HU', name: 'Magyar' },
  { code: 'pt-PT', name: 'Português' },
  { code: 'pl-PL', name: 'Polski' },
  { code: 'sv-SE', name: 'Svenska' },
  { code: 'tr-TR', name: 'Türkçe' },
];

describe('LANGUAGES', () => {
  it('should contain all supported languages with correct codes and names', () => {
    expect(LANGUAGES).toEqual(expectedLanguages);
  });

  it('should match a canonical locale definition', () => {
    for (const lang of LANGUAGES) {
      const resolved = Intl.getCanonicalLocales(lang.code);
      expect(lang.code).toEqual(resolved[0]);
    }
  });

  it('should have locale codes including the country code', () => {
    for (const lang of LANGUAGES) {
      if (lang.code === 'pseudo') {
        // special case pseudo because its not a real language
        continue;
      }
      expect(lang.code).toMatch(/^[a-z]{2}-[a-zA-Z]+$/);
    }
  });

  it('should not have duplicate languages codes', () => {
    for (let i = 0; i < LANGUAGES.length; i++) {
      const lang = LANGUAGES[i];
      const index = LANGUAGES.findIndex((v) => v.code === lang.code);
      expect(index).toBe(i);
    }
  });
});
