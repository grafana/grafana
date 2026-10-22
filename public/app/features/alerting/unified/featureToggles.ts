import { config } from '@grafana/runtime';
import {
  FlagKeys,
  getFeatureFlagClient,
  useFlagAlertingImportAlertmanagerAPI,
  useFlagAlertingMigrationWizardUI,
} from '@grafana/runtime/internal';

import { getPreviewToggle } from './previewToggles';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const shouldUseRulesAPIV2 = () => config.featureToggles['alerting.rulesAPIV2'] ?? false;

/**
 * Whether the new list view is turned on for this instance. When it's off, everyone gets the old list,
 * whatever they picked with the "use new / previous experience" button.
 */
export const isAlertingListViewV2Allowed = () => config.featureToggles.alertingListViewV2 ?? false;

export const shouldShowAlertingListViewV2PreviewToggle = () =>
  (config.featureToggles.alertingListViewV2PreviewToggle ?? false) && isAlertingListViewV2Allowed();

/**
 * Whether the rule list, and the pages that link to it, should use the new list view.
 * The old list view is deprecated and will be removed in a future release; this goes away with it.
 */
export const shouldUseAlertingListViewV2 = () => {
  if (!isAlertingListViewV2Allowed()) {
    return false;
  }

  // Someone who went back to the old list with the "previous experience" button stays on it,
  // even after that button is no longer offered to them.
  return getPreviewToggle('alertingListViewV2') ?? true;
};

export const isImportWizardEnabled = () =>
  getFeatureFlagClient().getBooleanValue(FlagKeys.AlertingMigrationWizardUI, false);

// Importing Alertmanager config (the wizard's notifications step, the staged config on the Import
// settings tab, and auto-sync) goes through the Alertmanager import API, which answers 501 while its
// flag is off. Rule import doesn't use that API, so the wizard itself only needs its own flag and just
// locks its notifications step.
export const isAlertmanagerImportEnabled = () =>
  isImportWizardEnabled() && getFeatureFlagClient().getBooleanValue(FlagKeys.AlertingImportAlertmanagerAPI, false);

/** React version of {@link isAlertmanagerImportEnabled} that re-renders when either flag changes. */
export function useIsAlertmanagerImportEnabled(): boolean {
  const wizardUIEnabled = useFlagAlertingMigrationWizardUI();
  const importAlertmanagerAPIEnabled = useFlagAlertingImportAlertmanagerAPI();
  return wizardUIEnabled && importAlertmanagerAPIEnabled;
}

export const shouldUseBackendFilters = () => config.featureToggles.alertingUIUseBackendFilters ?? false;

export const shouldUseFullyCompatibleBackendFilters = () =>
  config.featureToggles.alertingUIUseFullyCompatBackendFilters ?? false;

// Backends older than the notificationHistoryEnabled setting don't send it. Treat a missing value as
// enabled, which matches the default of the feature toggles this setting replaced, so the UI doesn't
// disappear while the frontend is deployed ahead of the backend.
export const isNotificationHistoryEnabled = (cfg = config) => cfg.unifiedAlerting.notificationHistoryEnabled ?? true;
