import { uniq } from 'lodash';

// we mock this in jest as import.meta.glob breaks things, so we don't even attempt to load enterprise translations...
import { localeExtensionImports, type LocaleFileLoader } from './extensions';

// TODO: this is just to satisfy extensions which import this type from this file.
export type { LocaleFileLoader };

export const ENGLISH_US = 'en-US';
export const FRENCH_FRANCE = 'fr-FR';
export const SPANISH_SPAIN = 'es-ES';
export const GERMAN_GERMANY = 'de-DE';
export const BRAZILIAN_PORTUGUESE = 'pt-BR';
export const CHINESE_SIMPLIFIED = 'zh-Hans';
export const PSEUDO_LOCALE = 'pseudo';

export const DEFAULT_LANGUAGE = ENGLISH_US;

const importLanguageFile = (languageCode: string) =>
  import(`../../../locales/${languageCode}/grafana.json`).then((data) => data.default);

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
      grafana: () => importLanguageFile('en-US'),
    },
  },

  {
    code: FRENCH_FRANCE,
    name: 'Français',
    loader: {
      grafana: () => importLanguageFile('fr-FR'),
    },
  },

  {
    code: SPANISH_SPAIN,
    name: 'Español',
    loader: {
      grafana: () => importLanguageFile('es-ES'),
    },
  },

  {
    code: GERMAN_GERMANY,
    name: 'Deutsch',
    loader: {
      grafana: () => importLanguageFile('de-DE'),
    },
  },

  {
    code: CHINESE_SIMPLIFIED,
    name: '中文（简体）',
    loader: {
      grafana: () => importLanguageFile('zh-Hans'),
    },
  },

  {
    code: BRAZILIAN_PORTUGUESE,
    name: 'Português Brasileiro',
    loader: {
      grafana: () => importLanguageFile('pt-BR'),
    },
  },
] satisfies Array<LanguageDefinition<'grafana'>>;

if (process.env.NODE_ENV === 'development') {
  LANGUAGES.push({
    code: PSEUDO_LOCALE,
    name: 'Pseudo-locale',
    loader: {
      grafana: () => importLanguageFile('pseudo-LOCALE'),
    },
  });
}

// Optionally load enterprise locale extensions, if they are present.
// It is important that this happens before NAMESPACES is defined so it has the correct value
//
if (process.env.NODE_ENV !== 'test') {
  const localeExtensionExports = Object.values(localeExtensionImports);

  if (localeExtensionExports.length > 0) {
    const { LOCALE_EXTENSIONS, ENTERPRISE_I18N_NAMESPACE } = localeExtensionExports[0];

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
