import { config } from '@grafana/runtime';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const isRecoverDeletedRulesEnabled = () => (config.featureToggles.alertingRuleRecoverDeleted && config.featureToggles.alertRuleRestore)?? false;
