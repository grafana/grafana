import i18n, { InitOptions, TFunction } from 'i18next';
import LanguageDetector, { DetectorOptions } from 'i18next-browser-languagedetector';
import { ReactElement, useMemo } from 'react';
import { Trans as I18NextTrans, initReactI18next } from 'react-i18next'; // eslint-disable-line no-restricted-imports

import { usePluginContext } from '@grafana/data';
import { DEFAULT_LANGUAGE } from '@grafana/data/unstable';
import { setTransComponent, setUseTranslateHook, TransProps } from '@grafana/runtime/unstable';

import { NAMESPACES, VALID_LANGUAGES } from './constants';
import { loadTranslations } from './loadTranslations';

let tFunc: TFunction<string[], undefined> | undefined;
let i18nInstance: typeof i18n;

export async function initializeI18n(language: string): Promise<{ language: string | undefined }> {
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
    supportedLngs: VALID_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,

    ns: NAMESPACES,
    postProcess: [
      // Add pseudo processing even if we aren't necessarily going to use it
      'pseudo',
    ],
  };

  i18nInstance = i18n;
  if (language === 'detect') {
    i18nInstance = i18nInstance.use(LanguageDetector);
    const detection: DetectorOptions = { order: ['navigator'], caches: [] };
    options.detection = detection;
  } else {
    options.lng = VALID_LANGUAGES.includes(language) ? language : undefined;
  }

  i18nInstance.use(loadTranslations).use(initReactI18next); // passes i18n down to react-i18next

  if (process.env.NODE_ENV === 'development') {
    const { default: Pseudo } = await import('i18next-pseudo');
    i18nInstance.use(
      new Pseudo({
        languageToPseudo: 'pseudo',
        enabled: true,
        wrapped: true,
      })
    );
  }

  await i18nInstance.init(options);

  tFunc = i18n.getFixedT(null, NAMESPACES);

  setUseTranslateHook(useTranslateInternal);
  setTransComponent(Trans);

  return {
    language: i18nInstance.resolvedLanguage,
  };
}

export function changeLanguage(locale: string) {
  const validLocale = VALID_LANGUAGES.includes(locale) ? locale : undefined;
  return i18n.changeLanguage(validLocale);
}

export const Trans = (props: TransProps): ReactElement => {
  const context = usePluginContext();

  // If we are in a plugin context, use the plugin's id as the namespace
  if (context?.meta?.id) {
    return <I18NextTrans shouldUnescape ns={context.meta.id} {...props} />;
  }

  return <I18NextTrans shouldUnescape ns={NAMESPACES} {...props} />;
};

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

export function getI18next() {
  if (!tFunc) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        'An attempt to internationalize was made before it was initialized. This was probably caused by calling a locale-aware function in the root module scope, instead of in render'
      );
    }

    if (process.env.NODE_ENV === 'development') {
      throw new Error('getI18next was called before i18n was initialized');
    }

    return i18n;
  }

  return i18nInstance || i18n;
}

// We want to move to a react-only API for translations.
// This hook doesn't do much now, but we want it to define the API for plugins.
// Perhaps in the future this will use useTranslation from react-i18next or something else
// from context
export function useTranslateInternal() {
  const context = usePluginContext();
  if (!context) {
    return t;
  }

  const { meta } = context;
  const pluginT = useMemo(() => getI18next().getFixedT(null, meta.id), [meta.id]);
  return pluginT;
}
