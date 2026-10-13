import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { getPreviewToggle } from './previewToggles';
import { isAdmin } from './utils/environment';

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

export const shouldAllowRecoveringDeletedRules = () =>
  isAdmin() &&
  getFeatureFlagClient().getBooleanValue(FlagKeys.AlertingRuleRecoverDeleted, true) &&
  getFeatureFlagClient().getBooleanValue(FlagKeys.AlertRuleRestore, true);

export const shouldAllowPermanentlyDeletingRules = () => shouldAllowRecoveringDeletedRules();

export const shouldUseBackendFilters = () => config.featureToggles.alertingUIUseBackendFilters ?? false;

export const shouldUseFullyCompatibleBackendFilters = () =>
  config.featureToggles.alertingUIUseFullyCompatBackendFilters ?? false;

// Backends older than the notificationHistoryEnabled setting don't send it. Treat a missing value as
// enabled, which matches the default of the feature toggles this setting replaced, so the UI doesn't
// disappear while the frontend is deployed ahead of the backend.
export const isNotificationHistoryEnabled = (cfg = config) => cfg.unifiedAlerting.notificationHistoryEnabled ?? true;
