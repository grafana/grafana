export const ENGLISH_US = 'en-US';
export const FRENCH_FRANCE = 'fr-FR';
export const SPANISH_SPAIN = 'es-ES';
export const GERMAN_GERMANY = 'de-DE';
export const BRAZILIAN_PORTUGUESE = 'pt-BR';
export const CHINESE_SIMPLIFIED = 'zh-Hans';
export const ITALIAN_ITALY = 'it-IT';
export const JAPANESE_JAPAN = 'ja-JP';
export const INDONESIAN_INDONESIA = 'id-ID';
export const KOREAN_KOREA = 'ko-KR';
export const RUSSIAN_RUSSIA = 'ru-RU';
export const CZECH_CZECHIA = 'cs-CZ';
export const DUTCH_NETHERLANDS = 'nl-NL';
export const HUNGARIAN_HUNGARY = 'hu-HU';
export const PORTUGUESE_PORTUGAL = 'pt-PT';
export const POLISH_POLAND = 'pl-PL';
export const SWEDISH_SWEDEN = 'sv-SE';
export const TURKISH_TURKEY = 'tr-TR';
export const CHINESE_TRADITIONAL = 'zh-Hant';

/**
 * Default language.
 */
export const DEFAULT_LANGUAGE = ENGLISH_US;

interface TranslationDefinition {
  code: string;
  name: string;
}

/**
 * Supported languages for translation.
 */
export const LANGUAGES: TranslationDefinition[] = [
  { code: ENGLISH_US, name: 'English' },
  { code: FRENCH_FRANCE, name: 'Français' },
  { code: SPANISH_SPAIN, name: 'Español' },
  { code: GERMAN_GERMANY, name: 'Deutsch' },
  { code: CHINESE_SIMPLIFIED, name: '中文（简体）' },
  { code: BRAZILIAN_PORTUGUESE, name: 'Português Brasileiro' },
  { code: CHINESE_TRADITIONAL, name: '中文（繁體）' },
  { code: ITALIAN_ITALY, name: 'Italiano' },
  { code: JAPANESE_JAPAN, name: '日本語' },
  { code: INDONESIAN_INDONESIA, name: 'Bahasa Indonesia' },
  { code: KOREAN_KOREA, name: '한국어' },
  { code: RUSSIAN_RUSSIA, name: 'Русский' },
  { code: CZECH_CZECHIA, name: 'Čeština' },
  { code: DUTCH_NETHERLANDS, name: 'Nederlands' },
  { code: HUNGARIAN_HUNGARY, name: 'Magyar' },
  { code: PORTUGUESE_PORTUGAL, name: 'Português' },
  { code: POLISH_POLAND, name: 'Polski' },
  { code: SWEDISH_SWEDEN, name: 'Svenska' },
  { code: TURKISH_TURKEY, name: 'Türkçe' },
];
