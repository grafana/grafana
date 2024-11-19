import { config } from '@grafana/runtime';
import { DashboardSpec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { DashboardDTO } from 'app/types';

import { DashboardWithAccessInfo } from './types';

export function getDashboardsApiVersion() {
  console.log(
    'Dashboard API version:',
    config.featureToggles.dashboardScene,
    config.featureToggles.kubernetesDashboards,
    config.featureToggles.useV2DashboardsAPI
  );
  // if dashboard scene is disabled, use legacy API response for the old architecture
  if (!config.featureToggles.dashboardScene) {
    // for old architecture, use v0 API for k8s dashboards
    if (config.featureToggles.kubernetesDashboards) {
      return 'v0';
    }

    return 'legacy';
  }

  if (config.featureToggles.useV2DashboardsAPI) {
    return 'v2';
  }

  if (config.featureToggles.kubernetesDashboards) {
    return 'v0';
  }

  return 'legacy';
}

export function isDashboardResource(
  obj?: DashboardDTO | DashboardWithAccessInfo<DashboardSpec> | null
): obj is DashboardWithAccessInfo<DashboardSpec> {
  if (!obj) {
    return false;
  }

  return 'kind' in obj && obj.kind === 'DashboardWithAccessInfo';
}
