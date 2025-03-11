import { ResourceKey } from 'i18next';
import { uniq } from 'lodash';

import { config } from '@grafana/runtime';

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

export const PSEUDO_LOCALE = 'pseudo';

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

// New languages added recently without translations available yet
const NEW_LANGUAGES: LanguageDefinition[] = [
  {
    code: CHINESE_TRADITIONAL,
    name: '中文（繁體）',
    loader: {
      grafana: () => import('../../../locales/zh-Hant/grafana.json'),
    },
  },

  {
    code: ITALIAN_ITALY,
    name: 'Italiano',
    loader: {
      grafana: () => import('../../../locales/it-IT/grafana.json'),
    },
  },

  {
    code: JAPANESE_JAPAN,
    name: '日本語',
    loader: {
      grafana: () => import('../../../locales/ja-JP/grafana.json'),
    },
  },

  {
    code: INDONESIAN_INDONESIA,
    name: 'Bahasa Indonesia',
    loader: {
      grafana: () => import('../../../locales/id-ID/grafana.json'),
    },
  },

  {
    code: KOREAN_KOREA,
    name: '한국어',
    loader: {
      grafana: () => import('../../../locales/ko-KR/grafana.json'),
    },
  },

  {
    code: RUSSIAN_RUSSIA,
    name: 'Русский',
    loader: {
      grafana: () => import('../../../locales/ru-RU/grafana.json'),
    },
  },

  {
    code: CZECH_CZECHIA,
    name: 'Čeština',
    loader: {
      grafana: () => import('../../../locales/cs-CZ/grafana.json'),
    },
  },

  {
    code: DUTCH_NETHERLANDS,
    name: 'Nederlands',
    loader: {
      grafana: () => import('../../../locales/nl-NL/grafana.json'),
    },
  },

  {
    code: HUNGARIAN_HUNGARY,
    name: 'Magyar',
    loader: {
      grafana: () => import('../../../locales/hu-HU/grafana.json'),
    },
  },

  {
    code: PORTUGUESE_PORTUGAL,
    name: 'Português',
    loader: {
      grafana: () => import('../../../locales/pt-PT/grafana.json'),
    },
  },

  {
    code: POLISH_POLAND,
    name: 'Polski',
    loader: {
      grafana: () => import('../../../locales/pl-PL/grafana.json'),
    },
  },

  {
    code: SWEDISH_SWEDEN,
    name: 'Svenska',
    loader: {
      grafana: () => import('../../../locales/sv-SE/grafana.json'),
    },
  },

  {
    code: TURKISH_TURKEY,
    name: 'Türkçe',
    loader: {
      grafana: () => import('../../../locales/tr-TR/grafana.json'),
    },
  },
];

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

  {
    code: CHINESE_SIMPLIFIED,
    name: '中文（简体）',
    loader: {
      grafana: () => import('../../../locales/zh-Hans/grafana.json'),
    },
  },

  {
    code: BRAZILIAN_PORTUGUESE,
    name: 'Português Brasileiro',
    loader: {
      grafana: () => import('../../../locales/pt-BR/grafana.json'),
    },
  },
] satisfies Array<LanguageDefinition<'grafana'>>;

if (config.featureToggles?.extraLanguages) {
  LANGUAGES.push(...NEW_LANGUAGES);
}

if (process.env.NODE_ENV === 'development') {
  LANGUAGES.push({
    code: PSEUDO_LOCALE,
    name: 'Pseudo-locale',
    loader: {
      // Load the English locale as the pseudo-locale,
      // as it will be post-processed by i18next-pseudo library
      grafana: () => import('../../../locales/en-US/grafana.json'),
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
