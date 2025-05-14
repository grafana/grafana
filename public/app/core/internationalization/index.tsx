import { ReactElement } from 'react';

import { Trans as TransCore, TransProps } from '@grafana/i18n';
import { changeLanguage as changeLanguageCore, initTranslations, t as tCore } from '@grafana/i18n/internal';

import { NAMESPACES, VALID_LANGUAGES } from './constants';
import { loadTranslations } from './loadTranslations';

// This is a placeholder so we can put a 'comment' in the message json files.
// Starts with an underscore so it's sorted to the top of the file. Even though it is in a comment the following line is still extracted
// t('_comment', 'The code is the source of truth for English phrases. They should be updated in the components directly, and additional plurals specified in this file.');

export async function initializeI18n(language: string): Promise<{ language: string | undefined }> {
  return initTranslations({ language, ns: NAMESPACES, module: loadTranslations });
}

export function changeLanguage(locale: string) {
  const validLocale = VALID_LANGUAGES.includes(locale) ? locale : undefined;
  return changeLanguageCore(validLocale);
}

export const Trans = (props: TransProps): ReactElement => <TransCore {...props} />;

/**
 * This is a simple wrapper over i18n.t() to provide default namespaces and enforce a consistent API.
 * Note: Don't use this in the top level module scope. This wrapper needs initialization, which is done during Grafana
 * startup, and it will throw if used before.
 *
 * This will soon be deprecated in favor of useTranslate()
 * @param id ID of the translation string
 * @param defaultMessage Default message to use if the translation is missing
 * @param values Values to be interpolated into the string
 */
export const t = (id: string, defaultMessage: string, values?: Record<string, unknown>) =>
  tCore(id, defaultMessage, values);
