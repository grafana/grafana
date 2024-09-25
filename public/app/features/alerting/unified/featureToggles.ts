import { useMemo } from 'react';

import { config } from '@grafana/runtime';

export const alertingFeatureToggles = {
  apiServer: config.featureToggles.alertingApiServer ?? false,
  prometheusRulesPrimary: config.featureToggles.alertingPrometheusRulesPrimary ?? false,
};

export const useAlertingFeatureToggles = () => {
  return useMemo(() => alertingFeatureToggles, []);
};
