import { config } from '@grafana/runtime';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const useGrafanaManagedRecordingRulesSupport = () =>
  config.unifiedAlerting.recordingRulesEnabled && config.featureToggles.grafanaManagedRecordingRules;
