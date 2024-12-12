import { config } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

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

// This function is used to determine if the dashboard is in v2 format or also v0 format
export function isDashboardResource(
  obj?: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec> | DashboardWithAccessInfo<DashboardDataDTO> | null
): obj is DashboardWithAccessInfo<DashboardV2Spec> | DashboardWithAccessInfo<DashboardDataDTO> {
  if (!obj) {
    return false;
  }
  // is v0 or v2 format?
  const isK8sDashboard = 'kind' in obj && obj.kind === 'DashboardWithAccessInfo';
  return isK8sDashboard;
}

export function isDashboardV2Spec(obj: object): obj is DashboardV2Spec {
  return 'elements' in obj;
}

export function isDashboardV0Spec(obj: object): obj is DashboardDataDTO {
  return !isDashboardV2Spec(obj); // not v2 spec means it's v0 spec
}
