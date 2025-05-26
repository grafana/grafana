import { ReactElement } from 'react';

import {
  initPluginTranslations,
  Trans as I18NTrans,
  useTranslate as useI18NTranslate,
  TransProps,
} from '@grafana/i18n';

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
  initPluginTranslations('grafana-ui');
}

export const Trans = (props: TransProps): ReactElement => {
  initI18n();
  return <I18NTrans {...props} />;
};

export const useTranslate = () => {
  initI18n();
  return useI18NTranslate();
};
