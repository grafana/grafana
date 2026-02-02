import { cloneDeep, mapValues, merge } from 'lodash';

import {
  ARABIC_ARABIC,
  ENGLISH_CANADA,
  ENGLISH_US,
  FRENCH_CANADA,
  FRENCH_FRANCE,
  GERMAN_GERMANY,
  ITALIAN_ITALY,
  LANGUAGES,
  SPANISH_SPAIN,
} from 'app/core/internationalization/constants';

type keyValPair = { [key: string]: string };

export type LanguageCode =
  | typeof ENGLISH_US
  | typeof ENGLISH_CANADA
  | typeof FRENCH_CANADA
  | typeof FRENCH_FRANCE
  | typeof SPANISH_SPAIN
  | typeof GERMAN_GERMANY
  | typeof ITALIAN_ITALY
  | typeof ARABIC_ARABIC;

export type DashboardLocale = {
  [key in LanguageCode]: keyValPair;
} & {
  default: keyValPair;
};

export const LanguageOptions = () => {
  return LANGUAGES.map((l) => {
    return { label: l.name, value: l.code };
  });
};

export const initializeDashboardLocale = () => {
  const locale: DashboardLocale = {
    default: {},
    'en-US': {},
    'en-CA': {},
    'de-DE': {},
    'es-ES': {},
    'fr-CA': {},
    'fr-FR': {},
    'it-IT': {},
    'ar-AR': {},
  };
  return locale;
};

export const initializeGlobalLocale = (): DashboardLocale => {
  const locale: any = initializeDashboardLocale();
  delete locale.default;
  return locale;
};

export const getRequiredLocales = (data: any): DashboardLocale => {
  const providedLocales = (data as DashboardLocale) ?? initializeDashboardLocale();
  const baseLocales = initializeDashboardLocale();

  const defaultTemplate = Object.keys(providedLocales.default ?? {}).reduce<keyValPair>(
    (acc, key) => ({ ...acc, [key]: '' }),
    {}
  );

  const filledLocales = mapValues(baseLocales, (localeData, localeKey) => {
    if (localeKey === 'default') {
      return localeData;
    }
    return Object.keys(localeData).length > 0 ? localeData : cloneDeep(defaultTemplate);
  }) as DashboardLocale;

  return cloneDeep(merge(filledLocales, providedLocales));
};
