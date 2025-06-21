import { ResourceKey } from 'i18next';
import { uniq } from 'lodash';

import { DEFAULT_LANGUAGE, PSEUDO_LOCALE, LANGUAGES as SUPPORTED_LANGUAGES } from '@grafana/i18n';

export type LocaleFileLoader = () => Promise<ResourceKey>;

export const GRAFANA_NAMESPACE = 'grafana' as const;

type BaseLanguageDefinition = (typeof SUPPORTED_LANGUAGES)[number];
export interface LanguageDefinition<Namespace extends string = string> extends BaseLanguageDefinition {
  /** Function to load translations */
  loader: Record<Namespace, LocaleFileLoader>;
}

export const LANGUAGES: LanguageDefinition[] = SUPPORTED_LANGUAGES.map((def) => {
  // Load the Default language (en-US) as the pseudo-locale, as it will be post-processed by i18next-pseudo library
  const locale = def.code === PSEUDO_LOCALE ? DEFAULT_LANGUAGE : def.code;
  return {
    ...def,
    loader: { [GRAFANA_NAMESPACE]: () => import(`../../../locales/${locale}/grafana.json`) },
  };
});

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
