"use client";

import { css } from '@emotion/css';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
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
  resourceUri: string
  disabled?: boolean
  preferenceType: "org" | "team" | "user"
  onConfirm?: () => Promise<boolean>
}

export type State = UserPreferencesDTO & {
  isLoading: boolean
  isSubmitting: boolean
}

function getLanguageOptions(): ComboboxOption[] {
  const languageOptions = LANGUAGES.map((v) => ({
    value: v.code,
    label: v.name,
  })).sort((a, b) => {
    if (a.value === PSEUDO_LOCALE) {
      return 1
    }

    if (b.value === PSEUDO_LOCALE) {
      return -1
    }

    return a.label.localeCompare(b.label)
  })

  if (process.env.NODE_ENV === "development") {
    languageOptions.push({
      value: PSEUDO_LOCALE,
      label: "Pseudo-locale",
    })
  }

  const options = [
    {
      value: "",
      label: t("common.locale.default", "Default"),
    },
    ...languageOptions,
  ]

  return options
}

function getRegionalFormatOptions(): ComboboxOption[] {
  const localeOptions = LOCALES.map((v) => ({
    value: v.code,
    label: v.name,
  })).sort((a, b) => {
    return a.label.localeCompare(b.label)
  })

  const options = [
    {
      value: "",
      label: t("common.locale.default", "Default"),
    },
    ...localeOptions,
  ]
  return options
}

function getTranslatedThemeName(theme: ThemeRegistryItem) {
  switch (theme.id) {
    case "dark":
      return t("shared.preferences.theme.dark-label", "Dark")
    case "light":
      return t("shared.preferences.theme.light-label", "Light")
    case "system":
      return t("shared.preferences.theme.system-label", "System preference")
    default:
      return theme.name
  }
}

export const SharedPreferences: React.FC<Props> = ({ resourceUri, disabled, preferenceType, onConfirm }) => {
  const [state, setState] = useState<State>({
    isLoading: false,
    isSubmitting: false,
    theme: "",
    timezone: "",
    weekStart: "",
    language: "",
    regionalFormat: "",
    queryHistory: { homeTab: "" },
    navbar: { bookmarkUrls: [] },
  })

  const service = React.useMemo(() => new PreferencesService(resourceUri), [resourceUri])

  const themeOptions = React.useMemo(() => {
    const themes = getSelectableThemes()
    const options = themes.map((theme) => ({
      value: theme.id,
      label: getTranslatedThemeName(theme),
      group: theme.isExtra ? t("shared-preferences.theme.experimental", "Experimental") : undefined,
    }))

    // Add default option
    options.unshift({ value: "", label: t("shared-preferences.theme.default-label", "Default"), group: undefined })
    return options
  }, [])

  const languageOptions = React.useMemo(() => getLanguageOptions(), [])
  const regionalFormatOptions = React.useMemo(() => getRegionalFormatOptions(), [])

  useEffect(() => {
    const loadPreferences = async () => {
      setState((prev) => ({ ...prev, isLoading: true }))

      try {
        const prefs = await service.load()
        setState((prev) => ({
          ...prev,
          isLoading: false,
          homeDashboardUID: prefs.homeDashboardUID,
          theme: prefs.theme,
          timezone: prefs.timezone,
          weekStart: prefs.weekStart,
          language: prefs.language,
          regionalFormat: prefs.regionalFormat,
          queryHistory: prefs.queryHistory,
          navbar: prefs.navbar,
        }))
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    }

    loadPreferences()
  }, [service])

  const onSubmitForm = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const confirmationResult = onConfirm ? await onConfirm() : true

      if (confirmationResult) {
        const { homeDashboardUID, theme, timezone, weekStart, language, regionalFormat, queryHistory, navbar } = state
        reportInteraction("grafana_preferences_save_button_clicked", {
          preferenceType,
          theme,
          language,
        })

        setState((prev) => ({ ...prev, isSubmitting: true }))

        try {
          await service.update({
            homeDashboardUID,
            theme,
            timezone,
            weekStart,
            language,
            regionalFormat,
            queryHistory,
            navbar,
          })
          window.location.reload()
        } finally {
          setState((prev) => ({ ...prev, isSubmitting: false }))
        }
      }
    },
    [state, onConfirm, preferenceType, service],
  )

  const onThemeChanged = useCallback(
    (value: ComboboxOption<string>) => {
      setState((prev) => ({ ...prev, theme: value.value }))
      reportInteraction("grafana_preferences_theme_changed", {
        toTheme: value.value,
        preferenceType,
      })

      if (value.value) {
        changeTheme(value.value, true)
      }
    },
    [preferenceType],
  )

  const onTimeZoneChanged = useCallback((timezone?: string) => {
    if (typeof timezone !== "string") {
      return
    }
    setState((prev) => ({ ...prev, timezone }))
  }, [])

  const onWeekStartChanged = useCallback((weekStart?: WeekStart) => {
    setState((prev) => ({ ...prev, weekStart: weekStart ?? "" }))
  }, [])

  const onHomeDashboardChanged = useCallback((dashboardUID: string) => {
    setState((prev) => ({ ...prev, homeDashboardUID: dashboardUID }))
  }, [])

  const onLanguageChanged = useCallback(
    (language: string) => {
      setState((prev) => ({ ...prev, language }))

      reportInteraction("grafana_preferences_language_changed", {
        toLanguage: language,
        preferenceType,
      })
    },
    [preferenceType],
  )

  const onLocaleChanged = useCallback(
    (regionalFormat: string) => {
      setState((prev) => ({ ...prev, regionalFormat }))

      reportInteraction("grafana_preferences_regional_format_changed", {
        toRegionalFormat: regionalFormat,
        preferenceType,
      })
    },
    [preferenceType],
  )

  const { theme, timezone, weekStart, homeDashboardUID, language, isLoading, isSubmitting, regionalFormat } = state
  const styles = getStyles()
  const currentThemeOption = themeOptions.find((x) => x.value === theme) ?? themeOptions[0]

  return (
    <form onSubmit={onSubmitForm} className={styles.form}>
      <FieldSet label={<Trans i18nKey="shared-preferences.title">Preferences</Trans>} disabled={disabled}>
        <Field
          loading={isLoading}
          disabled={isLoading}
          label={t("shared-preferences.fields.theme-label", "Interface theme")}
          description={
            config.featureToggles.grafanaconThemes && config.feedbackLinksEnabled ? (
              <Trans i18nKey="shared-preferences.fields.theme-description">
                Enjoying the experimental themes? Tell us what you'd like to see{" "}
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
            onChange={onThemeChanged}
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
            onChange={(v) => onHomeDashboardChanged(v?.uid ?? "")}
            defaultOptions={true}
            isClearable={true}
            placeholder={t("shared-preferences.fields.home-dashboard-placeholder", "Default dashboard")}
            inputId="home-dashboard-select"
          />
        </Field>

        <Field
          loading={isLoading}
          disabled={isLoading}
          label={t("shared-dashboard.fields.timezone-label", "Timezone")}
          data-testid={selectors.components.TimeZonePicker.containerV2}
        >
          <TimeZonePicker
            includeInternal={true}
            value={timezone}
            onChange={onTimeZoneChanged}
            inputId="shared-preferences-timezone-picker"
          />
        </Field>

        <Field
          loading={isLoading}
          disabled={isLoading}
          label={t("shared-preferences.fields.week-start-label", "Week start")}
          data-testid={selectors.components.WeekStartPicker.containerV2}
        >
          <WeekStartPicker
            value={weekStart && isWeekStart(weekStart) ? weekStart : undefined}
            onChange={onWeekStartChanged}
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
            value={languageOptions.find((lang) => lang.value === language)?.value || ""}
            onChange={(lang: ComboboxOption | null) => onLanguageChanged(lang?.value ?? "")}
            options={languageOptions}
            placeholder={t("shared-preferences.fields.language-preference-placeholder", "Choose language")}
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
              "shared-preferences.fields.locale-preference-description",
              "Choose your region to see the corresponding date, time, and number format",
            )}
            data-testid="User preferences locale drop down"
          >
            <Combobox
              value={regionalFormatOptions.find((loc) => loc.value === regionalFormat)?.value || ""}
              onChange={(locale: ComboboxOption | null) => onLocaleChanged(locale?.value ?? "")}
              options={regionalFormatOptions}
              placeholder={t("shared-preferences.fields.locale-preference-placeholder", "Choose region")}
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
  )
}

export default SharedPreferences

const getStyles = stylesFactory(() => {
  return {
    labelText: css({
      marginRight: "6px",
    }),
    form: css({
      width: "100%",
      maxWidth: "600px",
    }),
  }
})
