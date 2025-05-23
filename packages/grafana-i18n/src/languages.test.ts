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

  it('should include the pseudo-locale in development mode', async () => {
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    const { LANGUAGES: languages } = await import('./languages');

    expect(languages).toEqual([...expectedLanguages, { code: 'pseudo', name: 'Pseudo-locale' }]);
  });

  it('should not include the pseudo-locale in production mode', async () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { LANGUAGES: languages } = await import('./languages');

    expect(languages).toEqual(expectedLanguages);
  });
});
