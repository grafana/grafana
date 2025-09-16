import { css } from '@emotion/css';
import { PureComponent } from 'react';
import * as React from 'react';

import { FeatureState, ThemeRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { PSEUDO_LOCALE, t, Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Preferences as UserPreferencesDTO } from '@grafana/schema/src/raw/preferences/x/preferences_types.gen';
import {
  Button,
  Field,
  FieldSet,
  Label,
  stylesFactory,
  TimeZonePicker,
  WeekStartPicker,
  FeatureBadge,
  Combobox,
  ComboboxOption,
  TextLink,
  WeekStart,
  isWeekStart,
} from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { LANGUAGES } from 'app/core/internationalization/constants';
import { LOCALES } from 'app/core/internationalization/locales';
import { PreferencesService } from 'app/core/services/PreferencesService';
import { changeTheme } from 'app/core/services/theme';

import { getSelectableThemes } from '../ThemeSelector/getSelectableThemes';

export interface Props {
  resourceUri: string;
  disabled?: boolean;
  preferenceType: 'org' | 'team' | 'user';
  onConfirm?: () => Promise<boolean>;
}

export type State = UserPreferencesDTO & {
  isLoading: boolean;
  isSubmitting: boolean;
};
function getLanguageOptions(): ComboboxOption[] {
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
}

function getRegionalFormatOptions(): ComboboxOption[] {
  const localeOptions = LOCALES.map((v) => ({
    value: v.code,
    label: v.name,
  })).sort((a, b) => {
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
}

export class SharedPreferences extends PureComponent<Props, State> {
  service: PreferencesService;
  themeOptions: ComboboxOption[];
  languageOptions: ComboboxOption[];
  regionalFormatOptions: ComboboxOption[];

  constructor(props: Props) {
    super(props);

    this.service = new PreferencesService(props.resourceUri);
    this.state = {
      isLoading: false,
      isSubmitting: false,
      theme: '',
      timezone: '',
      weekStart: '',
      language: '',
      regionalFormat: '',
      queryHistory: { homeTab: '' },
      navbar: { bookmarkUrls: [] },
    };

    const themes = getSelectableThemes();

    // Options are translated, so must be called after init but call them
    // in constructor to avoid memo-break of array changing every render
    this.themeOptions = themes.map((theme) => ({
      value: theme.id,
      label: getTranslatedThemeName(theme),
      group: theme.isExtra ? t('shared-preferences.theme.experimental', 'Experimental') : undefined,
    }));
    this.languageOptions = getLanguageOptions();
    this.regionalFormatOptions = getRegionalFormatOptions();

    // Add default option
    this.themeOptions.unshift({ value: '', label: t('shared-preferences.theme.default-label', 'Default') });
  }

  async componentDidMount() {
    this.setState({
      isLoading: true,
    });
    const prefs = await this.service.load();

    this.setState({
      isLoading: false,
      homeDashboardUID: prefs.homeDashboardUID,
      theme: prefs.theme,
      timezone: prefs.timezone,
      weekStart: prefs.weekStart,
      language: prefs.language,
      regionalFormat: prefs.regionalFormat,
      queryHistory: prefs.queryHistory,
      navbar: prefs.navbar,
    });
  }

  onSubmitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const confirmationResult = this.props.onConfirm ? await this.props.onConfirm() : true;

    if (confirmationResult) {
      const { homeDashboardUID, theme, timezone, weekStart, language, regionalFormat, queryHistory, navbar } =
        this.state;
      reportInteraction('grafana_preferences_save_button_clicked', {
        preferenceType: this.props.preferenceType,
        theme,
        language,
      });
      this.setState({ isSubmitting: true });
      await this.service
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
          this.setState({ isSubmitting: false });
        });
      window.location.reload();
    }
  };

  onThemeChanged = (value: ComboboxOption<string>) => {
    this.setState({ theme: value.value });
    reportInteraction('grafana_preferences_theme_changed', {
      toTheme: value.value,
      preferenceType: this.props.preferenceType,
    });

    if (value.value) {
      changeTheme(value.value, true);
    }
  };

  onTimeZoneChanged = (timezone?: string) => {
    if (typeof timezone !== 'string') {
      return;
    }
    this.setState({ timezone: timezone });
  };

  onWeekStartChanged = (weekStart?: WeekStart) => {
    this.setState({ weekStart: weekStart ?? '' });
  };

  onHomeDashboardChanged = (dashboardUID: string) => {
    this.setState({ homeDashboardUID: dashboardUID });
  };

  onLanguageChanged = (language: string) => {
    this.setState({ language });

    reportInteraction('grafana_preferences_language_changed', {
      toLanguage: language,
      preferenceType: this.props.preferenceType,
    });
  };

  onLocaleChanged = (regionalFormat: string) => {
    this.setState({ regionalFormat });

    reportInteraction('grafana_preferences_regional_format_changed', {
      toRegionalFormat: regionalFormat,
      preferenceType: this.props.preferenceType,
    });
  };

  render() {
    const { theme, timezone, weekStart, homeDashboardUID, language, isLoading, isSubmitting, regionalFormat } =
      this.state;
    const { disabled } = this.props;
    const styles = getStyles();
    const currentThemeOption = this.themeOptions.find((x) => x.value === theme) ?? this.themeOptions[0];

    return (
      <form onSubmit={this.onSubmitForm} className={styles.form}>
        <FieldSet label={<Trans i18nKey="shared-preferences.title">Preferences</Trans>} disabled={disabled}>
          <Field
            loading={isLoading}
            disabled={isLoading}
            label={t('shared-preferences.fields.theme-label', 'Interface theme')}
            description={
              config.featureToggles.grafanaconThemes && config.feedbackLinksEnabled ? (
                <Trans i18nKey="shared-preferences.fields.theme-description">
                  Enjoying the experimental themes? Tell us what you'd like to see{' '}
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
              options={this.themeOptions}
              value={currentThemeOption.value}
              onChange={this.onThemeChanged}
              id="shared-preferences-theme-select"
            />
          </Field>

          <Field
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
              onChange={(v) => this.onHomeDashboardChanged(v?.uid ?? '')}
              defaultOptions={true}
              isClearable={true}
              placeholder={t('shared-preferences.fields.home-dashboard-placeholder', 'Default dashboard')}
              inputId="home-dashboard-select"
            />
          </Field>

          <Field
            loading={isLoading}
            disabled={isLoading}
            label={t('shared-dashboard.fields.timezone-label', 'Timezone')}
            data-testid={selectors.components.TimeZonePicker.containerV2}
          >
            <TimeZonePicker
              includeInternal={true}
              value={timezone}
              onChange={this.onTimeZoneChanged}
              inputId="shared-preferences-timezone-picker"
            />
          </Field>

          <Field
            loading={isLoading}
            disabled={isLoading}
            label={t('shared-preferences.fields.week-start-label', 'Week start')}
            data-testid={selectors.components.WeekStartPicker.containerV2}
          >
            <WeekStartPicker
              value={weekStart && isWeekStart(weekStart) ? weekStart : undefined}
              onChange={this.onWeekStartChanged}
              inputId="shared-preferences-week-start-picker"
            />
          </Field>

          <Field
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
              value={this.languageOptions.find((lang) => lang.value === language)?.value || ''}
              onChange={(lang: ComboboxOption | null) => this.onLanguageChanged(lang?.value ?? '')}
              options={this.languageOptions}
              placeholder={t('shared-preferences.fields.language-preference-placeholder', 'Choose language')}
              id="language-preference-select"
            />
          </Field>
          {config.featureToggles.localeFormatPreference && (
            <Field
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
                value={this.regionalFormatOptions.find((loc) => loc.value === regionalFormat)?.value || ''}
                onChange={(locale: ComboboxOption | null) => this.onLocaleChanged(locale?.value ?? '')}
                options={this.regionalFormatOptions}
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
          <Trans i18nKey="common.save">Save</Trans>
        </Button>
      </form>
    );
  }
}

export default SharedPreferences;

const getStyles = stylesFactory(() => {
  return {
    labelText: css({
      marginRight: '6px',
    }),
    form: css({
      width: '100%',
      maxWidth: '600px',
    }),
  };
});

function getTranslatedThemeName(theme: ThemeRegistryItem) {
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
}
