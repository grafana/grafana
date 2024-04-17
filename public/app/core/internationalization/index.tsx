import i18n, { InitOptions, TFunction } from 'i18next';
import LanguageDetector, { DetectorOptions } from 'i18next-browser-languagedetector';
import React from 'react';
import { Trans as I18NextTrans, initReactI18next } from 'react-i18next'; // eslint-disable-line no-restricted-imports

import { DEFAULT_LANGUAGE, VALID_LANGUAGES } from './constants';
import { loadTranslations } from './loadTranslations';

let tFunc: TFunction<string[], undefined> | undefined;

export function initializeI18n(language: string): Promise<{ language: string | undefined }> {
  // This is a placeholder so we can put a 'comment' in the message json files.
  // Starts with an underscore so it's sorted to the top of the file. Even though it is in a comment the following line is still extracted
  // t('_comment', 'This file is the source of truth for English strings. Edit this to change plurals and other phrases for the UI.');

  const options: InitOptions = {
    // We don't bundle any translations, we load them async
    partialBundledLanguages: true,
    resources: {},

    // If translations are empty strings (no translation), fall back to the default value in source code
    returnEmptyString: false,

    // Required to ensure that `resolvedLanguage` is set property when an invalid language is passed (such as through 'detect')
    supportedLngs: VALID_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
  };
  let i18nInstance = i18n;
  if (language === 'detect') {
    i18nInstance = i18nInstance.use(LanguageDetector);
    const detection: DetectorOptions = { order: ['navigator'], caches: [] };
    options.detection = detection;
  } else {
    options.lng = VALID_LANGUAGES.includes(language) ? language : undefined;
  }

  const loadPromise = i18nInstance
    .use(loadTranslations)
    .use(initReactI18next) // passes i18n down to react-i18next
    .init(options);

  tFunc = i18n.t;

  return loadPromise.then(() => {
    return {
      language: i18nInstance.resolvedLanguage,
    };
  });
}

export function changeLanguage(locale: string) {
  const validLocale = VALID_LANGUAGES.includes(locale) ? locale : undefined;
  return i18n.changeLanguage(validLocale);
}

export const Trans: typeof I18NextTrans = (props) => {
  return <I18NextTrans shouldUnescape {...props} />;
};

// Wrap t() to provide default namespaces and enforce a consistent API
export const t = (id: string, defaultMessage: string, values?: Record<string, unknown>) => {
  if (!tFunc) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        't() was called before i18n was initialized. This is probably caused by calling t() in the root module scope, instead of lazily on render'
      );
    }

    if (process.env.NODE_ENV === 'development') {
      throw new Error('t() was called before i18n was initialized');
    }

    tFunc = i18n.t;
  }

  return tFunc(id, defaultMessage, values);
};

export const i18nDate = (value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
  if (typeof value === 'string') {
    return i18nDate(new Date(value), format);
  }
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, format);
  return dateFormatter.format(value);
};
