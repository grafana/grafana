import { I18n, i18n } from '@lingui/core';
import { I18nProvider as LinguiI18nProvider } from '@lingui/react';
import React, { useEffect } from 'react';

import config from 'app/core/config';

import { messages as fallbackMessages } from '../../../locales/en-US/messages';

import { DEFAULT_LOCALE, VALID_LOCALES } from './constants';

let i18nInstance: I18n;

export async function initI18n(localInput: string = DEFAULT_LOCALE) {
  const validatedLocale = VALID_LOCALES.includes(localInput) ? localInput : DEFAULT_LOCALE;

  if (i18nInstance && i18nInstance.locale === validatedLocale) {
    return i18nInstance;
  }

  // Dynamically load the messages for the user's locale
  const imp =
    config.featureToggles.internationalization &&
    (await import(`../../../locales/${validatedLocale}/messages`).catch((err) => {
      // TODO: Properly return an error if we can't find the messages for a locale
      return err;
    }));

  i18n.load(validatedLocale, imp?.messages || fallbackMessages);

  // Browser support for Intl.PluralRules is good and covers what we support in .browserlistrc,
  // but because this could potentially be in a the critical path of loading the frontend lets
  // be extra careful
  // If this isnt loaded, Lingui will log a warning and plurals will not be translated correctly.
  const supportsPluralRules = 'Intl' in window && 'PluralRules' in Intl;
  if (supportsPluralRules) {
    const pluralsOrdinal = new Intl.PluralRules(validatedLocale, { type: 'ordinal' });
    const pluralsCardinal = new Intl.PluralRules(validatedLocale, { type: 'cardinal' });
    i18n.loadLocaleData(validatedLocale, {
      plurals(count: number, ordinal: boolean) {
        return (ordinal ? pluralsOrdinal : pluralsCardinal).select(count);
      },
    });
  }

  i18n.activate(validatedLocale);
  i18nInstance = i18n;

  return i18nInstance;
}

interface I18nProviderProps {
  children: React.ReactNode;
}
export function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    const locale = config.featureToggles.internationalization ? config.bootData.user.locale : DEFAULT_LOCALE;

    initI18n(locale);
  }, []);

  return (
    <LinguiI18nProvider i18n={i18n} forceRenderOnLocaleChange={false}>
      {children}
    </LinguiI18nProvider>
  );
}

// This is only really used for ModalManager, as that creates a new react root we need to make sure is localisable.
export function provideI18n<P extends {}>(WrappedWithI18N: React.ComponentType<P>) {
  const I18nProviderWrapper = (props: P) => {
    return (
      <I18nProvider>
        <WrappedWithI18N {...props} />
      </I18nProvider>
    );
  };
  return I18nProviderWrapper;
}
