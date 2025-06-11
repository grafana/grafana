import i18n, { InitOptions, ReactOptions, TFunction as I18NextTFunction } from 'i18next';
import LanguageDetector, { DetectorOptions } from 'i18next-browser-languagedetector';
// eslint-disable-next-line no-restricted-imports
import { initReactI18next, setDefaults, setI18n, Trans as I18NextTrans, getI18n } from 'react-i18next';

import { DEFAULT_LANGUAGE, PSEUDO_LOCALE } from './constants';
import { initRegionalFormat } from './dates';
import { LANGUAGES } from './languages';
import { ResourceLoader, Resources, TFunction, TransProps, TransType } from './types';

let tFunc: I18NextTFunction<string[], undefined> | undefined;
let transComponent: TransType;

// exported for testing
export async function loadPluginResources(id: string, language: string, loaders?: ResourceLoader[]) {
  if (!loaders?.length) {
    return;
  }

  return Promise.all(
    loaders.map(async (loader) => {
      try {
        const resources = await loader(language);
        addResourceBundle(language, id, resources);
      } catch (error) {
        console.error(`Error loading resources for plugin ${id} and language: ${language}`, error);
      }
    })
  );
}

// exported for testing
export function initDefaultI18nInstance() {
  // If the resources are not an object, we need to initialize the plugin translations
  if (getI18nInstance().options?.resources && typeof getI18nInstance().options.resources === 'object') {
    return;
  }

  const initPromise = getI18nInstance().use(initReactI18next).init({
    resources: {},
    returnEmptyString: false,
    lng: DEFAULT_LANGUAGE, // this should be the locale of the phrases in our source JSX
  });
  tFunc = getI18nInstance().t;
  transComponent = (props: TransProps) => <I18NextTrans shouldUnescape {...props} />;
  return initPromise;
}

// exported for testing
export function initDefaultReactI18nInstance() {
  // If the initReactI18next is not set, we need to set them
  if (getI18n()?.options?.react) {
    return;
  }

  const options: ReactOptions = {};
  setDefaults(options);
  setI18n(getI18nInstance());
}

export async function initPluginTranslations(id: string, loaders?: ResourceLoader[]) {
  await initDefaultI18nInstance();
  initDefaultReactI18nInstance();

  const language = getResolvedLanguage();
  tFunc = getI18nInstance().getFixedT(null, id);
  transComponent = (props: TransProps) => <I18NextTrans shouldUnescape ns={id} {...props} />;

  await loadPluginResources(id, language, loaders);

  return { language };
}

export function getI18nInstance() {
  return i18n;
}

interface Module {
  type: 'backend';
}

interface InitializeI18nOptions {
  ns?: string[];
  language?: string;
  module?: Module;
}

async function initTranslations({
  ns,
  language = DEFAULT_LANGUAGE,
  module,
}: InitializeI18nOptions): Promise<{ language: string | undefined }> {
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

  if (language === 'detect') {
    getI18nInstance().use(LanguageDetector);
    const detection: DetectorOptions = { order: ['navigator'], caches: [] };
    options.detection = detection;
  } else {
    options.lng = LANGUAGES.find((lang) => lang.code === language)?.code ?? undefined;
  }

  if (module) {
    getI18nInstance().use(module).use(initReactI18next); // passes i18n down to react-i18next
  } else {
    getI18nInstance().use(initReactI18next); // passes i18n down to react-i18next
  }

  if (process.env.NODE_ENV === 'development') {
    const { default: Pseudo } = await import('i18next-pseudo');
    getI18nInstance().use(
      new Pseudo({
        languageToPseudo: PSEUDO_LOCALE,
        enabled: true,
        wrapped: true,
      })
    );
  }

  await getI18nInstance().init(options);

  tFunc = getI18nInstance().t;
  transComponent = (props: TransProps) => <I18NextTrans shouldUnescape ns={ns} {...props} />;

  return {
    language: getResolvedLanguage(),
  };
}

export function getLanguage() {
  return getI18nInstance()?.language || DEFAULT_LANGUAGE;
}

export function getResolvedLanguage() {
  return getI18nInstance()?.resolvedLanguage || DEFAULT_LANGUAGE;
}

export function getNamespaces() {
  return getI18nInstance()?.options.ns;
}

export async function changeLanguage(language?: string) {
  const validLanguage = LANGUAGES.find((lang) => lang.code === language)?.code ?? DEFAULT_LANGUAGE;
  await getI18nInstance().changeLanguage(validLanguage);
}

export async function initializeI18n(
  { language, ns, module }: InitializeI18nOptions,
  regionalFormat: string
): Promise<{ language: string | undefined }> {
  initRegionalFormat(regionalFormat);
  return initTranslations({ language, ns, module });
}

export function addResourceBundle(language: string, namespace: string, resources: Resources) {
  getI18nInstance().addResourceBundle(language, namespace, resources, true, false);
}

export const t: TFunction = (id: string, defaultMessage: string, values?: Record<string, unknown>) => {
  initDefaultI18nInstance();
  if (!tFunc) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        't() was called before i18n was initialized. This is probably caused by calling t() in the root module scope, instead of lazily on render'
      );
    }

    if (process.env.NODE_ENV === 'development') {
      throw new Error('t() was called before i18n was initialized');
    }

    tFunc = getI18nInstance().t;
  }

  return tFunc(id, defaultMessage, values);
};

export function useTranslate() {
  initDefaultI18nInstance();
  return { t };
}

export function Trans(props: TransProps) {
  initDefaultI18nInstance();
  const Component = transComponent ?? I18NextTrans;
  return <Component shouldUnescape {...props} />;
}
