import { I18n, i18n } from '@lingui/core';

import { messages } from '../../locales/en/messages';

let i18nInstance: I18n;

export function initI18n(locale = 'en') {
  i18n.load(locale, messages);
  i18n.activate(locale);

  i18nInstance = i18n;
}

export function getI18n() {
  if (!i18nInstance) {
    initI18n();
  }

  return i18nInstance;
}
