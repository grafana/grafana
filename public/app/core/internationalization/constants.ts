import { ResourceKey } from 'i18next';

export const ENGLISH_US = 'en-US';
export const FRENCH_FRANCE = 'fr-FR';
export const SPANISH_SPAIN = 'es-ES';
export const GERMAN_GERMANY = 'de-DE';
export const CHINESE_SIMPLIFIED = 'zh-Hans';
export const PSEUDO_LOCALE = 'pseudo-LOCALE';

export const DEFAULT_LANGUAGE = ENGLISH_US;

interface LanguageDefinitions {
  /** IETF language tag for the language e.g. en-US */
  code: string;

  /** Language name to show in the UI. Should be formatted local to that language e.g. Français for French */
  name: string;

  /** Function to load translations */
  loader: () => Promise<ResourceKey>;
}

export const LANGUAGES: LanguageDefinitions[] = [
  {
    code: ENGLISH_US,
    name: 'English',
    loader: () => Promise.resolve({}),
  },

  {
    code: FRENCH_FRANCE,
    name: 'Français',
    loader: () => import('../../../locales/fr-FR/grafana.json'),
  },

  {
    code: SPANISH_SPAIN,
    name: 'Español',
    loader: () => import('../../../locales/es-ES/grafana.json'),
  },

  {
    code: GERMAN_GERMANY,
    name: 'Deutsch',
    loader: () => import('../../../locales/de-DE/grafana.json'),
  },

  {
    code: CHINESE_SIMPLIFIED,
    name: '中文（简体）',
    loader: () => import('../../../locales/zh-Hans/grafana.json'),
  },
];

if (process.env.NODE_ENV === 'development') {
  LANGUAGES.push({
    code: PSEUDO_LOCALE,
    name: 'Pseudo-locale',
    loader: () => import('../../../locales/pseudo-LOCALE/grafana.json'),
  });
}

export const VALID_LANGUAGES = LANGUAGES.map((v) => v.code);
