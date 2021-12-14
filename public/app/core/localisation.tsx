import React, { useState } from 'react';
import { I18n, i18n } from '@lingui/core';
import { I18nProvider as LinguiI18nProvider } from '@lingui/react';

import { messages } from '../../locales/en/messages';

let i18nInstance: I18n;

export function getI18n(locale = 'en') {
  if (i18nInstance) {
    return i18nInstance;
  }

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
  i18nInstance = i18n;

  return i18nInstance;
}

interface I18nProviderProps {
  children: React.ReactNode;
}
export function I18nProvider({ children }: I18nProviderProps) {
  const [i18nRef] = useState(() => getI18n());

  return <LinguiI18nProvider i18n={i18nRef}>{children}</LinguiI18nProvider>;
}
