import { config } from '@grafana/runtime';

export const isPublicDashboardsEnabled = () => {
  return Boolean(config.featureToggles.publicDashboards) && config.publicDashboardsEnabled;
};
