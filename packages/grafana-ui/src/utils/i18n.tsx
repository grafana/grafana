import i18next from 'i18next';
import React from 'react';
import { Trans as I18NextTrans, initReactI18next } from 'react-i18next'; // eslint-disable-line no-restricted-imports

// We want to translate grafana-ui without introducing any breaking changes for consumers
// who use grafana-ui outside of grafana (such as grafana.com self serve). The other struggle
// is that grafana-ui does not require a top-level provider component, so we don't get the
// chance to do the mandatory i18next setup that <Trans /> and t() requires
//
// We wrap <Trans /> and t() and do a simple check if it hasn't already been set up
// (Grafana will init i18next in app.ts), and just set it up with a minimal config
// to use the default phrases in the source jsx.

// Creates a default, english i18next instance when running outside of grafana.
// we don't support changing the locale of grafana ui when outside of Grafana
function initI18n() {
  if (!i18next.options.lng) {
    i18next.use(initReactI18next).init({
      resources: {},
      returnEmptyString: false,
      lng: 'en-US', // this should be the locale of the phrases in our source JSX
    });
  }
}

export const Trans: typeof I18NextTrans = (props) => {
  initI18n();
  return <I18NextTrans {...props} />;
};

export const t = (id: string, defaultMessage: string, values?: Record<string, unknown>) => {
  initI18n();
  return i18next.t(id, defaultMessage, values);
};
