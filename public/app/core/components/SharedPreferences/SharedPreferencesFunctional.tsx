import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { memo, useState, useEffect } from 'react';

import { FeatureState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Alert,
  Box,
  Button,
  Combobox,
  type ComboboxOption,
  FeatureBadge,
  Field,
  FieldSet,
  isWeekStart,
  Label,
  Stack,
  TextLink,
  TimeZonePicker,
  useStyles2,
  type WeekStart,
  WeekStartPicker,
} from '@grafana/ui';
import { changeTheme } from 'app/core/services/theme';

import { DashboardPicker } from '../Select/DashboardPicker';
import { getSelectableThemes } from '../ThemeSelector/getSelectableThemes';

import { languageChanged, regionalFormatChanged, saveButtonClicked, themeChanged } from './analytics/main';
import { useSharedPreferences } from './useSharedPreferences';
import {
  getLanguageOptions,
  getRegionalFormatOptions,
  getStyles,
  getTranslatedThemeName,
  type PrefsState,
  type Props,
} from './utils';

export const SharedPreferencesFunctional = memo((props: Props) => {
  const { resourceUri } = props;

  const [updatePreferences, { preferences: prefs, isLoading, isError, isUpdating, isUpdateError }] =
    useSharedPreferences(resourceUri);

  const isAnalyticsFrameworkEnabled = useBooleanFlagValue('analyticsFramework', true);
  const [state, setState] = useState<PrefsState>({
    theme: undefined,
    timezone: '',
    weekStart: '',
    language: '',
    regionalFormat: '',
    queryHistory: { homeTab: '' },
    navbar: { bookmarkUrls: [] },
    homeDashboardUID: '',
  });

  const themes = getSelectableThemes();
  const styles = useStyles2(getStyles);

  // Options are translated, so must be called after init but call them
  // in constructor to avoid memo-break of array changing every render
  const themeOptions: ComboboxOption[] = themes.map((theme) => ({
    value: theme.id,
    label: getTranslatedThemeName(theme),
    group: theme.isExtra ? t('shared-preferences.theme.experimental', 'Experimental') : undefined,
  }));
  const languageOptions: ComboboxOption[] = getLanguageOptions();
  const regionalFormatOptions: ComboboxOption[] = getRegionalFormatOptions();

  // Add default option
  themeOptions.unshift({ value: '', label: t('shared-preferences.theme.default-label', 'Default') });

  //TODO - stop copying API in a separate state, use react form hooks instead
  useEffect(() => {
    if (prefs) {
      setState(prefs);
    }
  }, [prefs]);

  const handleSubmitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const confirmationResult = props.onConfirm ? await props.onConfirm() : true;
    if (!confirmationResult) {
      return;
    }
    if (isAnalyticsFrameworkEnabled) {
      saveButtonClicked({
        preferenceType: props.preferenceType,
        theme: state.theme,
        language: state.language,
      });
    } else {
      reportInteraction('grafana_preferences_save_button_clicked', {
        preferenceType: props.preferenceType,
        theme: state.theme,
        language: state.language,
      });
    }

    const prefsData = state;
    // prevent page reload on save failure so the error banner remains visible
    try {
      await updatePreferences(prefsData);
    } catch {
      // error is surfaced via isUpdateError — just prevent the reload below
      return;
    }

    window.location.reload();
  };

  const handleThemeChanged = (value: ComboboxOption<string>) => {
    setState((prev) => ({ ...prev, theme: value.value }));
    if (isAnalyticsFrameworkEnabled) {
      themeChanged({
        toTheme: value.value,
        preferenceType: props.preferenceType,
      });
    } else {
      // eslint-disable-next-line no-restricted-syntax
      reportInteraction('grafana_preferences_theme_changed', {
        toTheme: value.value,
        preferenceType: props.preferenceType,
      });
    }

    if (value.value) {
      changeTheme(value.value, true);
    }
  };

  const handleTimeZoneChanged = (timezone?: string) => {
    if (typeof timezone !== 'string') {
      return;
    }
    setState((prev) => ({ ...prev, timezone }));
  };

  const handleWeekStartChanged = (weekStart?: WeekStart) => {
    weekStart ? setState((prev) => ({ ...prev, weekStart })) : setState((prev) => ({ ...prev, weekStart: '' }));
  };

  const handleDashboardChanged = (dashboardUID: string) => {
    setState((prev) => ({ ...prev, homeDashboardUID: dashboardUID }));
  };

  const handleLanguageChanged = (language: string) => {
    setState((prev) => ({ ...prev, language }));
    if (isAnalyticsFrameworkEnabled) {
      languageChanged({
        toLanguage: language,
        preferenceType: props.preferenceType,
      });
    } else {
      reportInteraction('grafana_preferences_language_changed', {
        toLanguage: language,
        preferenceType: props.preferenceType,
      });
    }
  };

  const handleRegionalFormatChanged = (regionalFormat: string) => {
    setState((prev) => ({ ...prev, regionalFormat }));
    if (isAnalyticsFrameworkEnabled) {
      regionalFormatChanged({
        toRegionalFormat: regionalFormat,
        preferenceType: props.preferenceType,
      });
    } else {
      reportInteraction('grafana_preferences_regional_format_changed', {
        toRegionalFormat: regionalFormat,
        preferenceType: props.preferenceType,
      });
    }
  };

  const currentThemeOption = themeOptions.find((x) => x.value === state.theme) ?? themeOptions[0];

  return (
    <form onSubmit={handleSubmitForm} className={styles.form}>
      {isError && (
        <Alert severity="error" title={t('shared-preferences.error.get-preferences', 'Error loading preferences')} />
      )}
      {isUpdateError && (
        <Alert
          severity="error"
          title={t('shared-preferences.error.update-preferences', 'Error updating preferences')}
        />
      )}
      <FieldSet label={<Trans i18nKey="shared-preferences.title">Preferences</Trans>} disabled={props.disabled}>
        <Stack direction="column" gap={2}>
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
              value={state.homeDashboardUID}
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
              value={state.timezone}
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
              value={state.weekStart && isWeekStart(state.weekStart) ? state.weekStart : undefined}
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
              value={languageOptions.find((lang) => lang.value === state.language)?.value || ''}
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
                <Label htmlFor="locale-preference-select">
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
                value={regionalFormatOptions.find((loc) => loc.value === state.regionalFormat)?.value || ''}
                onChange={(locale: ComboboxOption | null) => handleRegionalFormatChanged(locale?.value ?? '')}
                options={regionalFormatOptions}
                placeholder={t('shared-preferences.fields.locale-preference-placeholder', 'Choose region')}
                id="locale-preference-select"
              />
            </Field>
          )}
        </Stack>
      </FieldSet>
      <Box marginTop={6}>
        <Button
          disabled={isUpdating}
          type="submit"
          variant="primary"
          data-testid={selectors.components.UserProfile.preferencesSaveButton}
        >
          <Trans i18nKey="shared-preferences.save">Save preferences</Trans>
        </Button>
      </Box>
    </form>
  );
});

SharedPreferencesFunctional.displayName = 'SharedPreferencesFunctional';
