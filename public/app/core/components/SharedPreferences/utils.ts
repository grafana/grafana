import { css } from '@emotion/css';

import { type PreferencesSpec as UserPreferencesDTO } from '@grafana/api-clients/rtkq/preferences/v1';
import { type SelectableValue, type ThemeRegistryItem } from '@grafana/data';
import { LANGUAGES, PSEUDO_LOCALE, t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';

import { type DashboardPickerDTO } from '../Select/DashboardPicker';

export type PrefsState = UserPreferencesDTO;

/**
 * Reserved homeDashboardUID that stops the user > team > org fallback and shows the instance default home.
 * Mirrors the backend's preferences.GlobalHomeDashboardUID.
 */
export const GLOBAL_HOME_DASHBOARD_UID = 'global-home';

export const getGlobalHomeOption = (): SelectableValue<DashboardPickerDTO> => {
  const label = t('shared-preferences.fields.home-dashboard-global-home', 'Grafana home');
  return { value: { uid: GLOBAL_HOME_DASHBOARD_UID, name: label }, label, icon: 'home-alt' };
};

const compareStrings = (() => {
  let collator: Intl.Collator | undefined;

  return (a: string, b: string) => {
    if (!collator) {
      collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    }
    return collator.compare(a, b);
  };
})();

export const getLanguageOptions = (): ComboboxOption[] => {
  const languageOptions = LANGUAGES.map((v) => ({
    value: v.code,
    label: v.name,
  })).sort((a, b) => {
    if (a.value === PSEUDO_LOCALE) {
      return 1;
    }

    if (b.value === PSEUDO_LOCALE) {
      return -1;
    }

    return compareStrings(a.label, b.label);
  });

  if (process.env.NODE_ENV === 'development') {
    languageOptions.push({
      value: PSEUDO_LOCALE,
      label: 'Pseudo-locale',
    });
  }

  const options = [
    {
      value: '',
      label: t('common.locale.default', 'Default'),
    },
    ...languageOptions,
  ];

  return options;
};

export const getTranslatedThemeName = (theme: ThemeRegistryItem) => {
  switch (theme.id) {
    case 'dark':
      return t('shared.preferences.theme.dark-label', 'Dark');
    case 'light':
      return t('shared.preferences.theme.light-label', 'Light');
    case 'system':
      return t('shared.preferences.theme.system-label', 'System preference');
    default:
      return theme.name;
  }
};

export const getStyles = () => {
  return {
    labelText: css({
      marginRight: '6px',
    }),
    form: css({
      width: '100%',
      maxWidth: '600px',
    }),
  };
};
