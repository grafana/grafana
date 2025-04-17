import { config } from '@grafana/runtime';

import { isAdmin } from './utils/misc';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const shouldUseAlertingListViewV2 = () => config.featureToggles.alertingListViewV2 ?? false;

export const useGrafanaManagedRecordingRulesSupport = () =>
  config.unifiedAlerting.recordingRulesEnabled && config.featureToggles.grafanaManagedRecordingRules;

export const shouldAllowRecoveringDeletedRules = () =>
  (isAdmin() && config.featureToggles.alertingRuleRecoverDeleted && config.featureToggles.alertRuleRestore) ?? false;

export const shouldAllowPermanentlyDeletingRules = () =>
  (shouldAllowRecoveringDeletedRules() && config.featureToggles.alertingRulePermanentlyDelete) ?? false;
