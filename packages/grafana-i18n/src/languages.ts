import {
  ENGLISH_US,
  FRENCH_FRANCE,
  SPANISH_SPAIN,
  GERMAN_GERMANY,
  CHINESE_SIMPLIFIED,
  BRAZILIAN_PORTUGUESE,
  CHINESE_TRADITIONAL,
  ITALIAN_ITALY,
  JAPANESE_JAPAN,
  INDONESIAN_INDONESIA,
  KOREAN_KOREA,
  RUSSIAN_RUSSIA,
  CZECH_CZECHIA,
  DUTCH_NETHERLANDS,
  HUNGARIAN_HUNGARY,
  PORTUGUESE_PORTUGAL,
  POLISH_POLAND,
  SWEDISH_SWEDEN,
  TURKISH_TURKEY,
} from './constants';

interface TranslationDefinition {
  /** IETF language tag */
  code: string;

  /** The language name in its own language (e.g. "Français" for French) */
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
