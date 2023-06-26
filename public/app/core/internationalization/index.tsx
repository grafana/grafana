import i18n, { BackendModule } from 'i18next';
import React from 'react';
import { Trans as I18NextTrans, initReactI18next } from 'react-i18next'; // eslint-disable-line no-restricted-imports

import { DEFAULT_LANGUAGE, LANGUAGES, VALID_LANGUAGES } from './constants';

const loadTranslations: BackendModule = {
  type: 'backend',
  init() {},
  async read(language, namespace, callback) {
    const localeDef = LANGUAGES.find((v) => v.code === language);

    if (!localeDef) {
      return callback(new Error('No message loader available for ' + language), null);
    }

    const messages = await localeDef.loader();
    callback(null, messages);
  },
};

export function initializeI18n(language: string) {
  const validLocale = VALID_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;

  // This is a placeholder so we can put a 'comment' in the message json files.
  // Starts with an underscore so it's sorted to the top of the file
  t(
    '_comment',
    'Do not manually edit this file, or update these source phrases in Crowdin. The source of truth for English strings are in the code source'
  );

  return i18n
    .use(loadTranslations)
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
      lng: validLocale,

      // We don't bundle any translations, we load them async
      partialBundledLanguages: true,
      resources: {},

      // If translations are empty strings (no translation), fall back to the default value in source code
      returnEmptyString: false,

      pluralSeparator: '__',
    });
}

export function changeLanguage(locale: string) {
  const validLocale = VALID_LANGUAGES.includes(locale) ? locale : DEFAULT_LANGUAGE;
  return i18n.changeLanguage(validLocale);
}

export const Trans: typeof I18NextTrans = (props) => {
  return <I18NextTrans {...props} />;
};

// Reassign t() so i18next-parser doesn't warn on dynamic key, and we can have 'failOnWarnings' enabled
const tFunc = i18n.t;

export const t = (id: string, defaultMessage: string, values?: Record<string, unknown>) => {
  return tFunc(id, defaultMessage, values);
};

export const i18nDate = (value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
  if (typeof value === 'string') {
    return i18nDate(new Date(value), format);
  }
  const locale = i18n.options.lng ?? DEFAULT_LANGUAGE;

  const dateFormatter = new Intl.DateTimeFormat(locale, format);
  return dateFormatter.format(value);
};
