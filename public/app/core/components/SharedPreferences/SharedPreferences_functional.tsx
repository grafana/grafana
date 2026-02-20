import { css } from '@emotion/css';
import { memo, useState, useEffect } from 'react';

import {
  PreferencesSpec as UserPreferencesDTO,
  PreferencesQueryHistoryPreference,
  PreferencesNavbarPreference,
} from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { FeatureState, ThemeRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LANGUAGES, PSEUDO_LOCALE, t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  Button,
  Combobox,
  ComboboxOption,
  FeatureBadge,
  Field,
  FieldSet,
  isWeekStart,
  Label,
  TextLink,
  TimeZonePicker,
  useStyles2,
  WeekStart,
  WeekStartPicker,
} from '@grafana/ui';
import { LOCALES } from 'app/core/internationalization/locales';
import { PreferencesService } from 'app/core/services/PreferencesService';
import { changeTheme } from 'app/core/services/theme';

import { DashboardPicker } from '../Select/DashboardPicker';
import { getSelectableThemes } from '../ThemeSelector/getSelectableThemes';

//TODO add reportInteraction

const getLanguageOptions = (): ComboboxOption[] => {
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

    // eslint-disable-next-line no-restricted-syntax
    return a.label.localeCompare(b.label);
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

const getRegionalFormatOptions = (): ComboboxOption[] => {
  const localeOptions = LOCALES.map((v) => ({
    value: v.code,
    label: v.name,
  })).sort((a, b) => {
    // eslint-disable-next-line no-restricted-syntax
    return a.label.localeCompare(b.label);
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

const getTranslatedThemeName = (theme: ThemeRegistryItem) => {
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

const getStyles = () => {
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

export interface SharedPreferencesProps {
  resourceUri: string;
  disabled?: boolean;
  preferenceType: 'org' | 'team' | 'user';
  onConfirm?: () => Promise<boolean>;
}

export type SharedPreferencesState = UserPreferencesDTO & {
  isLoading: boolean;
  isSubmitting: boolean;
};

interface SharedPreferencesMore {
  service: PreferencesService;
  themeOptions: ComboboxOption[];
  languageOptions: ComboboxOption[];
  regionalFormatOptions: ComboboxOption[];
}

export const SharedPreferencesFunctional = memo(
  ({
    service,
    themeOptions,
    languageOptions,
    regionalFormatOptions,
    ...props
  }: SharedPreferencesMore & SharedPreferencesProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [theme, setTheme] = useState<string | undefined>(undefined);
    const [timezone, setTimezone] = useState<string | undefined>(undefined);
    const [weekStart, setWeekStart] = useState<string | undefined>(undefined);
    const [language, setLanguage] = useState<string | undefined>(undefined);
    const [regionalFormat, setRegionalFormat] = useState<string | undefined>(undefined);
    const [queryHistory, setQueryHistory] = useState<PreferencesQueryHistoryPreference | undefined>({ homeTab: '0' });
    const [navbar, setNavbar] = useState<PreferencesNavbarPreference | undefined>({ bookmarkUrls: [] });
    const [homeDashboardUID, setHomeDashboardUID] = useState<string | undefined>(undefined);
    const themes = getSelectableThemes();

    const styles = useStyles2(getStyles);

    service = new PreferencesService(props.resourceUri);

    // Options are translated, so must be called after init but call them
    // in constructor to avoid memo-break of array changing every render
    themeOptions = themes.map((theme) => ({
      value: theme.id,
      label: getTranslatedThemeName(theme),
      group: theme.isExtra ? t('shared-preferences.theme.experimental', 'Experimental') : undefined,
    }));
    languageOptions = getLanguageOptions();
    regionalFormatOptions = getRegionalFormatOptions();

    // Add default option
    themeOptions.unshift({ value: '', label: t('shared-preferences.theme.default-label', 'Default') });

    useEffect(() => {
      const loadPreferences = async () => {
        setIsLoading(true);
        try {
          const prefs = await service.load();
          setHomeDashboardUID(prefs.homeDashboardUID);
          setTheme(prefs.theme);
          setTimezone(prefs.timezone);
          setWeekStart(prefs.weekStart);
          setLanguage(prefs.language);
          setRegionalFormat(prefs.regionalFormat);
          setQueryHistory(prefs.queryHistory);
          setNavbar(prefs.navbar);
        } catch (err) {
          console.error('Failed to load preferences', err);
        } finally {
          setIsLoading(false);
        }
      };

      loadPreferences();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmitForm = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const confirmationResult = props.onConfirm ? await props.onConfirm() : true;
      if (!confirmationResult) {
        setIsSubmitting(true);
        await service
          .update({
            homeDashboardUID,
            theme,
            timezone,
            weekStart,
            language,
            regionalFormat,
            queryHistory,
            navbar,
          })
          .finally(() => {
            setIsSubmitting(false);
          });
        window.location.reload();
      }
    };

    const handleThemeChanged = (value: ComboboxOption<string>) => {
      setTheme(value.value);
      if (value.value) {
        changeTheme(value.value, true);
      }
    };

    const handleTimeZoneChanged = (timezone?: string) => {
      if (typeof timezone !== 'string') {
        return;
      }
      setTimezone(timezone);
    };

    const handleWeekStartChanged = (weekStart?: WeekStart) => {
      weekStart ? setWeekStart(weekStart) : setWeekStart(undefined);
    };

    const handleDashboardChanged = (dashboardUID: string) => {
      setHomeDashboardUID(dashboardUID);
    };

    const handleLanguageChanged = (language: string) => {
      setLanguage(language);
    };

    const handleRegionalFormatChanged = (regionalFormat: string) => {
      setRegionalFormat(regionalFormat);
    };

    const currentThemeOption = themeOptions.find((x) => x.value === theme) ?? themeOptions[0];

    return (
      <form onSubmit={handleSubmitForm} className={styles.form}>
        <FieldSet label={<Trans i18nKey="shared-preferences.title">Preferences</Trans>} disabled={props.disabled}>
          <Field
            noMargin
            loading={isLoading}
            disabled={isLoading}
            label={t('shared-preferences.fields.theme-label', 'Interface theme')}
            description={
              config.featureToggles.grafanaconThemes && config.feedbackLinksEnabled ? (
                <Trans i18nKey="shared-preferences.fields.theme-description">
                  Enjoying the experimental themes? Tell us what you&apos;d like to see{' '}
                  <TextLink
                    variant="bodySmall"
                    external
                    href="https://docs.google.com/forms/d/e/1FAIpQLSeRKAY8nUMEVIKSYJ99uOO-dimF6Y69_If1Q1jTLOZRWqK1cw/viewform?usp=dialog"
                  >
                    here.
                  </TextLink>
                </Trans>
              ) : undefined
            }
          >
            <Combobox
              options={themeOptions}
              value={currentThemeOption.value}
              onChange={handleThemeChanged}
              id="shared-preferences-theme-select"
            />
          </Field>

          <Field
            noMargin
            loading={isLoading}
            disabled={isLoading}
            label={
              <Label htmlFor="home-dashboard-select">
                <span className={styles.labelText}>
                  <Trans i18nKey="shared-preferences.fields.home-dashboard-label">Home Dashboard</Trans>
                </span>
              </Label>
            }
            data-testid="User preferences home dashboard drop down"
          >
            <DashboardPicker
              value={homeDashboardUID}
              onChange={(v) => handleDashboardChanged(v?.uid ?? '')}
              defaultOptions={true}
              isClearable={true}
              placeholder={t('shared-preferences.fields.home-dashboard-placeholder', 'Default dashboard')}
              inputId="home-dashboard-select"
            />
          </Field>

          <Field
            noMargin
            disabled={isLoading}
            label={t('shared-dashboard.fields.timezone-label', 'Timezone')}
            data-testid={selectors.components.TimeZonePicker.containerV2}
          >
            <TimeZonePicker
              includeInternal={true}
              value={timezone}
              onChange={handleTimeZoneChanged}
              inputId="shared-preferences-timezone-picker"
            />
          </Field>

          <Field
            noMargin
            loading={isLoading}
            disabled={isLoading}
            label={t('shared-preferences.fields.week-start-label', 'Week start')}
            data-testid={selectors.components.WeekStartPicker.containerV2}
          >
            <WeekStartPicker
              value={weekStart && isWeekStart(weekStart) ? weekStart : undefined}
              onChange={handleWeekStartChanged}
              inputId="shared-preferences-week-start-picker"
            />
          </Field>

          <Field
            noMargin
            loading={isLoading}
            disabled={isLoading}
            label={
              <Label htmlFor="language-preference-select">
                <span className={styles.labelText}>
                  <Trans i18nKey="shared-preferences.fields.language-preference-label">Language</Trans>
                </span>
                <FeatureBadge featureState={FeatureState.preview} />
              </Label>
            }
            data-testid="User preferences language drop down"
          >
            <Combobox
              value={languageOptions.find((lang) => lang.value === language)?.value || ''}
              onChange={(lang: ComboboxOption | null) => handleLanguageChanged(lang?.value ?? '')}
              options={languageOptions}
              placeholder={t('shared-preferences.fields.language-preference-placeholder', 'Choose language')}
              id="language-preference-select"
            />
          </Field>
          {config.featureToggles.localeFormatPreference && (
            <Field
              noMargin
              loading={isLoading}
              disabled={isLoading}
              label={
                <Label htmlFor="locale-preference">
                  <span className={styles.labelText}>
                    <Trans i18nKey="shared-preferences.fields.locale-preference-label">Region format</Trans>
                  </span>
                  <FeatureBadge featureState={FeatureState.preview} />
                </Label>
              }
              description={t(
                'shared-preferences.fields.locale-preference-description',
                'Choose your region to see the corresponding date, time, and number format'
              )}
              data-testid="User preferences locale drop down"
            >
              <Combobox
                value={regionalFormatOptions.find((loc) => loc.value === regionalFormat)?.value || ''}
                onChange={(locale: ComboboxOption | null) => handleRegionalFormatChanged(locale?.value ?? '')}
                options={regionalFormatOptions}
                placeholder={t('shared-preferences.fields.locale-preference-placeholder', 'Choose region')}
                id="locale-preference-select"
              />
            </Field>
          )}
        </FieldSet>
        <Button
          disabled={isSubmitting}
          type="submit"
          variant="primary"
          data-testid={selectors.components.UserProfile.preferencesSaveButton}
        >
          <Trans i18nKey="shared-preferences.save">Save preferences</Trans>
        </Button>
      </form>
    );
  }
);

SharedPreferencesFunctional.displayName = 'SharedPreferencesFunctional';
