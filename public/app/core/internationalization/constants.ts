import { ResourceKey } from 'i18next';
import { uniq } from 'lodash';

export const ENGLISH_US = 'en-US';
export const FRENCH_FRANCE = 'fr-FR';
export const SPANISH_SPAIN = 'es-ES';
export const GERMAN_GERMANY = 'de-DE';
export const BRAZILIAN_PORTUGUESE = 'pt-BR';
export const CHINESE_SIMPLIFIED = 'zh-Hans';
export const PSEUDO_LOCALE = 'pseudo';
// BMC code - BMC owned locales
export const FRENCH_CANADA = 'fr-CA';
export const ENGLISH_CANADA = 'en-CA';
export const ITALIAN_ITALY = 'it-IT';
export const ARABIC_ARABIC = 'ar-AR';
// BMC code - end

export const DEFAULT_LANGUAGE = ENGLISH_US;

export type LocaleFileLoader = () => Promise<ResourceKey>;

export interface LanguageDefinition<Namespace extends string = string> {
  /** IETF language tag for the language e.g. en-US */
  code: string;

  /** Language name to show in the UI. Should be formatted local to that language e.g. Français for French */
  name: string;

  /** Function to load translations */
  loader: Record<Namespace, LocaleFileLoader>;
}

export const LANGUAGES: LanguageDefinition[] = [
  {
    code: ENGLISH_US,
    name: 'English',
    loader: {
      grafana: () => import('../../../locales/en-US/grafana.json'),
    },
  },

  {
    code: FRENCH_FRANCE,
    name: 'Français',
    loader: {
      grafana: () => import('../../../locales/fr-FR/grafana.json'),
    },
  },

  {
    code: SPANISH_SPAIN,
    name: 'Español',
    loader: {
      grafana: () => import('../../../locales/es-ES/grafana.json'),
    },
  },

  {
    code: GERMAN_GERMANY,
    name: 'Deutsch',
    loader: {
      grafana: () => import('../../../locales/de-DE/grafana.json'),
    },
  },

  // BMC code - Canadian French
  {
    code: FRENCH_CANADA,
    name: 'Français (Canada)',
    loader: { grafana: () => import('../../../locales/fr-CA/grafana.json') },
  },

  // BMC code - Canadian English
  {
    code: ENGLISH_CANADA,
    name: 'English (Canada)',
    loader: { grafana: () => import('../../../locales/en-CA/grafana.json') },
  },

  // BMC code - Italian
  {
    code: ITALIAN_ITALY,
    name: 'Italiano',
    loader: { grafana: () => import('../../../locales/it-IT/grafana.json') },
  },

  // BMC code - Arabic
  {
    code: ARABIC_ARABIC,
    name: 'العربية',
    loader: {
      grafana: () => import('../../../locales/ar-AR/grafana.json'),
    },
  },

  // {
  //   code: CHINESE_SIMPLIFIED,
  //   name: '中文（简体）',
  //   loader: {
  //     grafana: () => import('../../../locales/zh-Hans/grafana.json'),
  //   },
  // },

  // {
  //   code: BRAZILIAN_PORTUGUESE,
  //   name: 'Português Brasileiro',
  //   loader: {
  //     grafana: () => import('../../../locales/pt-BR/grafana.json'),
  //   },
  // },
] satisfies Array<LanguageDefinition<'grafana'>>;

if (process.env.NODE_ENV === 'development') {
  LANGUAGES.push({
    code: PSEUDO_LOCALE,
    name: 'Pseudo-locale',
    loader: {
      grafana: () => import('../../../locales/pseudo-LOCALE/grafana.json'),
    },
  });
}

// Optionally load enterprise locale extensions, if they are present.
// It is important that this happens before NAMESPACES is defined so it has the correct value
//
// require.context doesn't work in jest, so we don't even attempt to load enterprise translations...
if (process.env.NODE_ENV !== 'test') {
  const extensionRequireContext = require.context('../../', true, /app\/extensions\/locales\/localeExtensions/);
  if (extensionRequireContext.keys().includes('app/extensions/locales/localeExtensions')) {
    const { LOCALE_EXTENSIONS, ENTERPRISE_I18N_NAMESPACE } = extensionRequireContext(
      'app/extensions/locales/localeExtensions'
    );

    for (const language of LANGUAGES) {
      const localeLoader = LOCALE_EXTENSIONS[language.code];

      if (localeLoader) {
        language.loader[ENTERPRISE_I18N_NAMESPACE] = localeLoader;
      }
    }
  }
}

export const VALID_LANGUAGES = LANGUAGES.map((v) => v.code);

export const NAMESPACES = uniq(LANGUAGES.flatMap((v) => Object.keys(v.loader)));

// BMC change - Locale constants
export const DashFolderLinkRegexp = /\/[df]\/([a-zA-Z0-9\_\-]+)(?!.*editview=)/;
