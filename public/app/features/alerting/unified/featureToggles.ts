import { config } from '@grafana/runtime';

import { getPreviewToggle } from './previewToggles';
import { isAdmin } from './utils/misc';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const shouldUseAlertingListViewV2 = () => {
  const previewToggleValue = getPreviewToggle('alertingListViewV2');

  // If the preview toggle is enabled and has configured value it should take precedence over the feature toggle
  if (config.featureToggles.alertingListViewV2PreviewToggle && previewToggleValue !== undefined) {
    return previewToggleValue;
  }

  return config.featureToggles.alertingListViewV2;
};

export const shouldAllowRecoveringDeletedRules = () =>
  (isAdmin() && config.featureToggles.alertingRuleRecoverDeleted && config.featureToggles.alertRuleRestore) ?? false;

export const shouldAllowPermanentlyDeletingRules = () =>
  (shouldAllowRecoveringDeletedRules() && config.featureToggles.alertingRulePermanentlyDelete) ?? false;

export const shouldUseBackendFilters = () => config.featureToggles.alertingUIUseBackendFilters ?? false;

export const shouldUseFullyCompatibleBackendFilters = () =>
  config.featureToggles.alertingUIUseFullyCompatBackendFilters ?? false;

/**
 * Saved searches feature - allows users to save and apply search queries on the Alert Rules page.
 */
export const shouldUseSavedSearches = () => config.featureToggles.alertingSavedSearches ?? false;

/**
 * New grouped navigation structure for Alerting
 */
export const shouldUseAlertingNavigationV2 = () => config.featureToggles.alertingNavigationV2 ?? false;
