import { config } from '@grafana/runtime';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const shouldUseAlertingListViewV2 = () => config.featureToggles.alertingListViewV2 ?? false;
