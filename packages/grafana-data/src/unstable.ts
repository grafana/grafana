/**
 * THESE APIS MUST NOT BE USED IN COMMUNITY PLUGINS.
 *
 * Unstable APIs are still in development and are subject to breaking changes
 * at any point, like feature flags but for APIS. They must only be used in
 * Grafana core and internal plugins where we can coordinate changes.
 *
 * Once mature, they will be moved to the main export, be available to plugins via the standard import path,
 * and be subject to the standard policies
 */

export {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  BRAZILIAN_PORTUGUESE,
  CHINESE_SIMPLIFIED,
  CHINESE_TRADITIONAL,
  CZECH_CZECHIA,
  DUTCH_NETHERLANDS,
  ENGLISH_US,
  FRENCH_FRANCE,
  GERMAN_GERMANY,
  HUNGARIAN_HUNGARY,
  INDONESIAN_INDONESIA,
  ITALIAN_ITALY,
  JAPANESE_JAPAN,
  KOREAN_KOREA,
  POLISH_POLAND,
  PORTUGUESE_PORTUGAL,
  RUSSIAN_RUSSIA,
  SPANISH_SPAIN,
  SWEDISH_SWEDEN,
  TURKISH_TURKEY,
} from './utils/i18n';
