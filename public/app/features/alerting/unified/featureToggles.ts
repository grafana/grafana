import { config } from '@grafana/runtime';

import { isAdmin } from './utils/misc';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const useGrafanaManagedRecordingRulesSupport = () =>
  config.unifiedAlerting.recordingRulesEnabled && config.featureToggles.grafanaManagedRecordingRules;

export const shouldAllowRecoveringDeletedRules = () =>
  (isAdmin() && config.featureToggles.alertingRuleRecoverDeleted && config.featureToggles.alertRuleRestore) ?? false;
