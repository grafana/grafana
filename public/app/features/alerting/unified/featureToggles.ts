import { config } from '@grafana/runtime';

import { getPreviewToggle } from './previewToggles';
import { isAdmin } from './utils/environment';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const shouldUseRulesAPIV2 = () => config.featureToggles['alerting.rulesAPIV2'] ?? false;

export const shouldShowAlertingListViewV2PreviewToggle = () =>
  config.featureToggles.alertingListViewV2PreviewToggle ?? false;

/**
 * Whether the rule list, and the pages that link to it, should use the new list view.
 * The old list view is deprecated and will be removed in a future release; this goes away with it.
 */
export const shouldUseAlertingListViewV2 = () => {
  // The "use new / previous experience" choice is only honoured while that button is still offered.
  // Otherwise someone who once went back to the old list would stay there after the button is gone.
  if (shouldShowAlertingListViewV2PreviewToggle()) {
    const previewToggleValue = getPreviewToggle('alertingListViewV2');

    if (previewToggleValue !== undefined) {
      return previewToggleValue;
    }
  }

  return config.featureToggles.alertingListViewV2 ?? false;
};

export const shouldAllowRecoveringDeletedRules = () =>
  (isAdmin() && config.featureToggles.alertingRuleRecoverDeleted && config.featureToggles.alertRuleRestore) ?? false;

export const shouldAllowPermanentlyDeletingRules = () =>
  (shouldAllowRecoveringDeletedRules() && config.featureToggles.alertingRulePermanentlyDelete) ?? false;

export const shouldUseBackendFilters = () => config.featureToggles.alertingUIUseBackendFilters ?? false;

export const shouldUseFullyCompatibleBackendFilters = () =>
  config.featureToggles.alertingUIUseFullyCompatBackendFilters ?? false;
