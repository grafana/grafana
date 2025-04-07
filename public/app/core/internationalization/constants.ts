import { ResourceKey } from 'i18next';
import { uniq } from 'lodash';

import { LANGUAGES as SUPPORTED_LANGUAGES } from '@grafana/data/unstable';

export type LocaleFileLoader = () => Promise<ResourceKey>;

export const PSEUDO_LOCALE = 'pseudo';

export interface LanguageDefinition<Namespace extends string = string> {
  /** IETF language tag for the language e.g. en-US */
  code: string;

  /** Language name to show in the UI. Should be formatted local to that language e.g. Français for French */
  name: string;

  /** Function to load translations */
  loader: Record<Namespace, LocaleFileLoader>;
}

export const LANGUAGES: LanguageDefinition[] = SUPPORTED_LANGUAGES.map((def) => ({
  ...def,
  loader: { grafana: () => import(`../../../locales/${def.code}/grafana.json`) },
}));

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
