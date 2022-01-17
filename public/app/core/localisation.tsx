import React, { useState } from 'react';
import { I18n, i18n } from '@lingui/core';
import { I18nProvider as LinguiI18nProvider } from '@lingui/react';

import { messages as enMessages } from '../../locales/en/messages';

interface MessagesData {
  messages: Record<string, string>;
}

const localeMap: Record<string, () => Promise<MessagesData>> = {
  en: () => Promise.resolve({ messages: enMessages }),
  es: () => import('../../locales/es/messages'),
  fr: () => import('../../locales/fr/messages'),
  'pseudo-LOCALE': () => import('../../locales/pseudo-LOCALE/messages'),
};

let i18nInstance: I18n;

function setLocale(locale: string, messages: Record<string, string>) {
  console.log('setting locale', { locale, messages });
  i18n.load(locale, messages);

  // Browser support for Intl.PluralRules is good and covers what we support in .browserlistrc,
  // but because this could potentially be in a the critical path of loading the frontend lets
  // be extra careful
  // If this isnt loaded, Lingui will log a warning and plurals will not be translated correctly.
  const supportsPluralRules = 'Intl' in window && 'PluralRules' in Intl;
  if (supportsPluralRules) {
    const pluralsOrdinal = new Intl.PluralRules(locale, { type: 'ordinal' });
    const pluralsCardinal = new Intl.PluralRules(locale, { type: 'cardinal' });
    i18n.loadLocaleData(locale, {
      plurals(count: number, ordinal: boolean) {
        return (ordinal ? pluralsOrdinal : pluralsCardinal).select(count);
      },
    });
  }

  i18n.activate(locale);
}

export function getI18n(locale = 'en') {
  if (i18nInstance) {
    return i18nInstance;
  }

  // TODO: this should match the locale being passed in
  setLocale(locale, enMessages);
  i18nInstance = i18n;

  const localePreference = localStorage.getItem('grafana_locale');
  if (localePreference && localeMap[localePreference]) {
    const importMessages = localeMap[localePreference];
    importMessages().then(({ messages }) => {
      setLocale(localePreference, messages);
    });
  }

  return i18nInstance;
}

interface I18nProviderProps {
  children: React.ReactNode;
}
export function I18nProvider({ children }: I18nProviderProps) {
  const [i18nRef] = useState(() => getI18n());

  return <LinguiI18nProvider i18n={i18nRef}>{children}</LinguiI18nProvider>;
}
