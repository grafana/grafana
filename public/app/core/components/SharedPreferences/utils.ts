import { css } from '@emotion/css';

import { type PreferencesSpec as UserPreferencesDTO } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import type { ThemeRegistryItem } from '@grafana/data/themes';
import { LANGUAGES, PSEUDO_LOCALE, t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';
import { type UpdatePrefsCmd } from 'app/api/clients/legacy';
import { LOCALES } from 'app/core/internationalization/locales';

export interface Props {
  resourceUri: string;
  disabled?: boolean;
  /** @deprecated No used in the new functional component */
  preferenceType: 'org' | 'team' | 'user';
  onConfirm?: () => Promise<boolean>;
}

export type State = UserPreferencesDTO & {
  isLoading: boolean;
  isSubmitting: boolean;
};

export type PrefsState = UserPreferencesDTO;

export const toUpdatePrefsCmd = (state: PrefsState): UpdatePrefsCmd => ({
  ...state,
  // generated UpdatePrefsCmd['theme'] is narrower than the actual API; backend accepts any string
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  theme: state.theme as UpdatePrefsCmd['theme'],
});

export const compareStrings = (() => {
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

export const getRegionalFormatOptions = (): ComboboxOption[] => {
  const localeOptions = LOCALES.map((v) => ({
    value: v.code,
    label: v.name,
  })).sort((a, b) => {
    return compareStrings(a.label, b.label);
  });

  const options = [
    {
      value: '',
      label: t('common.locale.default', 'Default'),
    },
    ...localeOptions,
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
