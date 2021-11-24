import { I18n, i18n } from '@lingui/core';

import { messages } from '../../locales/en/messages';

let i18nInstance: I18n;

export function initI18n(locale = 'en') {
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
}

export function getI18n() {
  if (!i18nInstance) {
    initI18n();
  }

  return i18nInstance;
}
