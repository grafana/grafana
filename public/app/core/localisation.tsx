import { I18n, i18n } from '@lingui/core';
import { I18nProvider as LinguiI18nProvider } from '@lingui/react';
import React, { useEffect } from 'react';

import config from 'app/core/config';

import { messages } from '../../locales/en/messages';

let i18nInstance: I18n;

export async function getI18n(locale = 'en') {
  if (i18nInstance) {
    return i18nInstance;
  }
  // Dynamically load the messages for the user's locale
  const imp =
    config.featureToggles.internationalization &&
    (await import(`../../locales/${locale}/messages`).catch((err) => {
      // TODO: Properly return an error if we can't find the messages for a locale
      return err;
    }));
  i18n.load(locale, imp?.messages || messages);

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
  useEffect(() => {
    let loc;
    if (config.featureToggles.internationalization) {
      // TODO: Use locale preference instead of weekStart
      switch (config.bootData.user.weekStart) {
        case 'saturday':
          loc = 'es';
          break;
        case 'sunday':
          loc = 'fr';
          break;
        default:
          loc = 'en';
          break;
      }
    }

    getI18n(loc);
  }, []);

  return (
    <LinguiI18nProvider i18n={i18n} forceRenderOnLocaleChange={false}>
      {children}
    </LinguiI18nProvider>
  );
}
