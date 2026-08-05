import { config } from '@grafana/runtime';

import { getPreviewToggle } from './previewToggles';
import { isAdmin } from './utils/misc';

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
  (isAdmin() && config.featureToggles.alertingRuleRecoverDeleted && config.featureToggles.alertRuleRestore) ?? false;

export const shouldAllowPermanentlyDeletingRules = () =>
  (shouldAllowRecoveringDeletedRules() && config.featureToggles.alertingRulePermanentlyDelete) ?? false;

export const shouldUseBackendFilters = () => config.featureToggles.alertingUIUseBackendFilters ?? false;

export const shouldUseFullyCompatibleBackendFilters = () =>
  config.featureToggles.alertingUIUseFullyCompatBackendFilters ?? false;
