const ENGLISH_US = 'en-US';
const FRENCH_FRANCE = 'fr-FR';
const SPANISH_SPAIN = 'es-ES';
const GERMAN_GERMANY = 'de-DE';
const BRAZILIAN_PORTUGUESE = 'pt-BR';
const CHINESE_SIMPLIFIED = 'zh-Hans';
const ITALIAN_ITALY = 'it-IT';
const JAPANESE_JAPAN = 'ja-JP';
const INDONESIAN_INDONESIA = 'id-ID';
const KOREAN_KOREA = 'ko-KR';
const RUSSIAN_RUSSIA = 'ru-RU';
const CZECH_CZECHIA = 'cs-CZ';
const DUTCH_NETHERLANDS = 'nl-NL';
const HUNGARIAN_HUNGARY = 'hu-HU';
const PORTUGUESE_PORTUGAL = 'pt-PT';
const POLISH_POLAND = 'pl-PL';
const SWEDISH_SWEDEN = 'sv-SE';
const TURKISH_TURKEY = 'tr-TR';
const CHINESE_TRADITIONAL = 'zh-Hant';

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
