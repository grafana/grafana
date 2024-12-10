import { config } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { DashboardDTO } from 'app/types';

import { DashboardWithAccessInfo } from './types';

export function getDashboardsApiVersion() {
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
  obj?: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec> | null
): obj is DashboardWithAccessInfo<DashboardV2Spec> {
  if (!obj) {
    return false;
  }

  return 'kind' in obj && obj.kind === 'DashboardWithAccessInfo' && isDashboardV2Spec(obj.spec);
}

export function isDashboardV2Spec(obj: object): obj is DashboardV2Spec {
  return 'elements' in obj;
}
