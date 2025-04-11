import i18n, { InitOptions, Module, Resource, TFunction } from 'i18next';
import LanguageDetector, { DetectorOptions } from 'i18next-browser-languagedetector';
import { ReactElement } from 'react';
// eslint-disable-next-line no-restricted-imports
import { initReactI18next, Trans as I18NextTrans } from 'react-i18next';

import { DEFAULT_LANGUAGE, PSEUDO_LOCALE } from './constants';
import { LANGUAGES } from './languages';
import { TransProps } from './types';

let tFunc: TFunction<string[], undefined> | undefined;
let i18nInstance: typeof i18n;
let pluginId: string | undefined;

export async function initTranslations(id: string): Promise<{ language: string | undefined }> {
  pluginId = id;

  if (i18nInstance) {
    return { language: i18nInstance.resolvedLanguage };
  }

  return initCoreTranslations({ language: DEFAULT_LANGUAGE, ns: [pluginId], from: 'external' });
}

interface InitializeI18nOptions {
  language: string;
  ns?: string[];
  module?: Module;
  from?: 'core' | 'external';
}

export async function initCoreTranslations({
  language,
  ns,
  module,
  from = 'core',
}: InitializeI18nOptions): Promise<{ language: string | undefined }> {
  if (i18nInstance) {
    return { language: i18nInstance.resolvedLanguage };
  }

  // This is a placeholder so we can put a 'comment' in the message json files.
  // Starts with an underscore so it's sorted to the top of the file. Even though it is in a comment the following line is still extracted
  // t('_comment', 'The code is the source of truth for English phrases. They should be updated in the components directly, and additional plurals specified in this file.');

  const options: InitOptions = {
    // We don't bundle any translations, we load them async
    partialBundledLanguages: true,
    resources: {},

    // If translations are empty strings (no translation), fall back to the default value in source code
    returnEmptyString: false,

    // Required to ensure that `resolvedLanguage` is set property when an invalid language is passed (such as through 'detect')
    supportedLngs: LANGUAGES.map((language) => language.code),
    fallbackLng: DEFAULT_LANGUAGE,

    ns,
    postProcess: [
      // Add pseudo processing even if we aren't necessarily going to use it
      PSEUDO_LOCALE,
    ],
  };

  i18nInstance = i18n;

  if (language === 'detect') {
    i18nInstance = i18nInstance.use(LanguageDetector);
    const detection: DetectorOptions = { order: ['navigator'], caches: [] };
    options.detection = detection;
  } else {
    options.lng = LANGUAGES.find((lang) => lang.code === language)?.code ?? undefined;
  }

  if (module) {
    i18nInstance.use(module).use(initReactI18next); // passes i18n down to react-i18next
  } else {
    i18nInstance.use(initReactI18next); // passes i18n down to react-i18next
  }

  if (process.env.NODE_ENV === 'development') {
    const { default: Pseudo } = await import('i18next-pseudo');
    i18nInstance.use(
      new Pseudo({
        languageToPseudo: PSEUDO_LOCALE,
        enabled: true,
        wrapped: true,
      })
    );
  }

  await i18nInstance.init(options);

  tFunc = i18nInstance.t;
  if (from === 'core') {
    window.__grafanaI18nContext = {
      t,
      getFixedT: i18nInstance.getFixedT,
      Trans: TransCore,
    };
  }

  return {
    language: i18nInstance.resolvedLanguage,
  };
}

export function getLanguage() {
  return i18nInstance?.language || DEFAULT_LANGUAGE;
}

export function getResolvedLanguage() {
  return i18nInstance?.resolvedLanguage || DEFAULT_LANGUAGE;
}

export function getNamespaces() {
  return i18nInstance?.options.ns;
}

export async function changeLanguage(language?: string) {
  await i18nInstance.changeLanguage(language ?? DEFAULT_LANGUAGE);
}

export function addResourceBundle(language: string, namespace: string, resource: Resource) {
  i18nInstance.addResourceBundle(language, namespace, resource, undefined, true);
}

export function t(id: string, defaultMessage: string, values?: Record<string, unknown>) {
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
}

export function useTranslate() {
  if (!pluginId) {
    return window.__grafanaI18nContext?.t ?? t;
  }

  if (window.__grafanaI18nContext?.getFixedT) {
    return window.__grafanaI18nContext.getFixedT(null, pluginId);
  }

  return i18nInstance.getFixedT(null, pluginId);
}

const TransCore = (props: TransProps): ReactElement => {
  return <I18NextTrans shouldUnescape ns={getNamespaces()} {...props} />;
};

export const Trans = (props: TransProps): ReactElement => {
  const Component = window.__grafanaI18nContext?.Trans ?? TransCore;

  if (pluginId) {
    return <Component {...props} ns={pluginId} />;
  }

  return <Component {...props} />;
};
