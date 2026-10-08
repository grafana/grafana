import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { getPreviewToggle } from './previewToggles';
import { isAdmin } from './utils/environment';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const shouldUseRulesAPIV2 = () => config.featureToggles['alerting.rulesAPIV2'] ?? false;

export const shouldUseAlertingListViewV2 = () => {
  const previewToggleValue = getPreviewToggle('alertingListViewV2');

  // If the user has set a preference via the preview toggle, it takes precedence
  if (previewToggleValue !== undefined) {
    return previewToggleValue;
  }

  return config.featureToggles.alertingListViewV2 ?? false;
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
