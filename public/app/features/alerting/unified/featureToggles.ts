import { config } from '@grafana/runtime';

import { getPreviewToggle } from './previewToggles';
import { isAdmin } from './utils/misc';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const shouldUseAlertingListViewV2 = () => {
  const previewToggleValue = getPreviewToggle('alertingListViewV2');

  // If the user has set a preference via the preview toggle, it takes precedence
  if (previewToggleValue !== undefined) {
    return previewToggleValue;
  }

  return config.featureToggles.alertingListViewV2 ?? false;
};

export const shouldUseRulesAPIV2 = () => config.featureToggles['alerting.rulesAPIV2'] ?? false;

export const shouldAllowRecoveringDeletedRules = () =>
  (isAdmin() && config.featureToggles.alertingRuleRecoverDeleted && config.featureToggles.alertRuleRestore) ?? false;

export const shouldAllowPermanentlyDeletingRules = () =>
  (shouldAllowRecoveringDeletedRules() && config.featureToggles.alertingRulePermanentlyDelete) ?? false;

export const shouldUseBackendFilters = () => config.featureToggles.alertingUIUseBackendFilters ?? false;

export const shouldUseFullyCompatibleBackendFilters = () =>
  config.featureToggles.alertingUIUseFullyCompatBackendFilters ?? false;

/**
 * Alerts Activity Banner - shows a promotional banner on the Rule List page
 * directing users to try the new Alerts Activity (triage) view.
 *
 * The banner is only shown if:
 * 1. This feature toggle is enabled (alertingAlertsActivityBanner)
 * 2. The Alerts Activity feature itself is enabled (alertingTriage)
 */
export const shouldShowAlertsActivityBanner = () =>
  (config.featureToggles.alertingAlertsActivityBanner && config.featureToggles.alertingTriage) ?? false;
