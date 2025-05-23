import i18n, { InitOptions, ReactOptions, TFunction } from 'i18next';
import LanguageDetector, { DetectorOptions } from 'i18next-browser-languagedetector';
// eslint-disable-next-line no-restricted-imports
import { initReactI18next, setDefaults, setI18n, Trans as I18NextTrans, getI18n } from 'react-i18next';

import { DEFAULT_LANGUAGE, PSEUDO_LOCALE } from './constants';
import { initRegionalFormat } from './dates';
import { LANGUAGES } from './languages';
import { TransProps, TransType } from './types';

let tFunc: TFunction<string[], undefined> | undefined;
let transComponent: TransType;

(async () => {
  // We want to translate grafana-ui without introducing any breaking changes for consumers
  // who use grafana-ui outside of grafana (such as grafana.com self serve). The other struggle
  // is that grafana-ui does not require a top-level provider component, so we don't get the
  // chance to do the mandatory i18next setup that <Trans /> and t() requires
  const isGrafanaContext = Object.hasOwn(window, 'grafanaBootData');
  const isTestContext = process.env.NODE_ENV === 'test';

  if (isGrafanaContext || isTestContext) {
    return;
  }

  console.log('Initializing a default i18n instance');
  await initPluginTranslations('unkown-context');
})();

async function initDefaultI18nInstance() {
  if (getI18nInstance().options?.resources && typeof getI18nInstance().options.resources === 'object') {
    return;
  }

  // If the resources are not an object, we need to initialize the plugin translations
  await getI18nInstance().use(initReactI18next).init({
    resources: {},
    returnEmptyString: false,
    lng: DEFAULT_LANGUAGE, // this should be the locale of the phrases in our source JSX
  });
}

function initDefaultReactI18nInstance() {
  if (getI18n()?.options?.react) {
    return;
  }

  // If the initReactI18next is not set, we need to set them
  const options: ReactOptions = {};
  setDefaults(options);
  setI18n(getI18nInstance());
}

export async function initPluginTranslations(id: string) {
  await initDefaultI18nInstance();
  initDefaultReactI18nInstance();

  tFunc = getI18nInstance().getFixedT(null, id);
  transComponent = (props: TransProps) => <I18NextTrans shouldUnescape ns={id} {...props} />;

  return { language: getI18nInstance().resolvedLanguage };
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
    language: getI18nInstance().resolvedLanguage,
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

type ResourceKey = string;
type ResourceLanguage = Record<string, ResourceKey>;
type ResourceType = Record<string, ResourceLanguage>;

export function addResourceBundle(language: string, namespace: string, resource: ResourceType) {
  getI18nInstance().addResourceBundle(language, namespace, resource, undefined, true);
}

function logError(entity: string) {
  const message = `${entity} was called before i18n was initialized. This is probably caused by calling ${entity} outside of Grafana context or by calling ${entity} in the root module scope, instead of lazily on render. Initializing default instances.`;
  console.error(message);
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    throw new Error(message);
  }
}

export function t(id: string, defaultMessage: string, values?: Record<string, unknown>) {
  if (!tFunc) {
    logError('t()');
    tFunc = getI18nInstance().t;
  }

  return tFunc(id, defaultMessage, values);
}

export function useTranslate() {
  if (!tFunc) {
    logError('useTranslate()');
    return { t: getI18nInstance().t };
  }

  return { t };
}

export function Trans(props: TransProps) {
  if (!transComponent) {
    logError('Trans()');
    return <I18NextTrans shouldUnescape {...props} />;
  }

  const Component = transComponent;
  return <Component shouldUnescape {...props} />;
}
