import { config } from '@grafana/runtime';

// export const alertingFeatureToggles = {
//   apiServer: config.featureToggles.alertingApiServer ?? false,
//   prometheusRulesPrimary: config.featureToggles.alertingPrometheusRulesPrimary ?? false,
// };

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;
