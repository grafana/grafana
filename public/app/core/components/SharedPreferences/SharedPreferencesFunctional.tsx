import { memo, useMemo, useState, useEffect } from 'react';

import { PreferencesSpec as UserPreferencesDTO } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { FeatureState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Box,
  Button,
  Combobox,
  ComboboxOption,
  FeatureBadge,
  Field,
  FieldSet,
  isWeekStart,
  Label,
  Stack,
  TextLink,
  TimeZonePicker,
  useStyles2,
  WeekStart,
  WeekStartPicker,
} from '@grafana/ui';
import { PreferencesService } from 'app/core/services/PreferencesService';
import { changeTheme } from 'app/core/services/theme';

import { DashboardPicker } from '../Select/DashboardPicker';
import { getSelectableThemes } from '../ThemeSelector/getSelectableThemes';

import { getLanguageOptions, getRegionalFormatOptions, getStyles, getTranslatedThemeName, Props, State } from './utils';

export const SharedPreferencesFunctional = memo((props: Props) => {
  const [state, setState] = useState<UserPreferencesDTO & State>({
    isLoading: false,
    isSubmitting: false,
    theme: '',
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

  const service = useMemo(() => new PreferencesService(props.resourceUri), [props.resourceUri]);

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

  useEffect(() => {
    const loadPreferences = async () => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const prefs = await service.load();
        setState((prev) => ({
          ...prev,
          homeDashboardUID: prefs.homeDashboardUID ?? prev.homeDashboardUID,
          theme: prefs.theme ?? prev.theme,
          timezone: prefs.timezone ?? prev.timezone,
          weekStart: prefs.weekStart ?? prev.weekStart,
          language: prefs.language ?? prev.language,
          regionalFormat: prefs.regionalFormat ?? prev.regionalFormat,
          queryHistory: prefs.queryHistory ?? prev.queryHistory,
          navbar: prefs.navbar ?? prev.navbar,
        }));
      } catch (err) {
        console.error('Failed to load preferences', err);
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    loadPreferences();
  }, [service]);

  const handleSubmitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const confirmationResult = props.onConfirm ? await props.onConfirm() : true;
    reportInteraction('grafana_preferences_save_button_clicked', {
      preferenceType: props.preferenceType,
      theme: state.theme,
      language: state.language,
    });
    if (!confirmationResult) {
      return;
    }
    setState((prev) => ({ ...prev, isSubmitting: true }));
    await service
      .update({
        homeDashboardUID: state.homeDashboardUID,
        theme: state.theme,
        timezone: state.timezone,
        weekStart: state.weekStart,
        language: state.language,
        regionalFormat: state.regionalFormat,
        queryHistory: state.queryHistory,
        navbar: state.navbar,
      })
      .finally(() => {
        setState((prev) => ({ ...prev, isSubmitting: false }));
      });
    window.location.reload();
  };

  const handleThemeChanged = (value: ComboboxOption<string>) => {
    setState((prev) => ({ ...prev, theme: value.value }));
    reportInteraction('grafana_preferences_theme_changed', {
      toTheme: value.value,
      preferenceType: props.preferenceType,
    });
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
    reportInteraction('grafana_preferences_language_changed', {
      toLanguage: language,
      preferenceType: props.preferenceType,
    });
  };

  const handleRegionalFormatChanged = (regionalFormat: string) => {
    setState((prev) => ({ ...prev, regionalFormat }));
    reportInteraction('grafana_preferences_regional_format_changed', {
      toRegionalFormat: regionalFormat,
      preferenceType: props.preferenceType,
    });
  };

  const currentThemeOption = themeOptions.find((x) => x.value === state.theme) ?? themeOptions[0];

  return (
    <form onSubmit={handleSubmitForm} className={styles.form}>
      <FieldSet label={<Trans i18nKey="shared-preferences.title">Preferences</Trans>} disabled={props.disabled}>
        <Stack direction="column" gap={2}>
          <Field
            noMargin
            loading={state.isLoading}
            disabled={state.isLoading}
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
            loading={state.isLoading}
            disabled={state.isLoading}
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
            disabled={state.isLoading}
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
            loading={state.isLoading}
            disabled={state.isLoading}
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
            loading={state.isLoading}
            disabled={state.isLoading}
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
              loading={state.isLoading}
              disabled={state.isLoading}
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
          disabled={state.isSubmitting}
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
