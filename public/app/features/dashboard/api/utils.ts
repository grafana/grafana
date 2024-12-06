import { config, locationService } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

import { DashboardWithAccessInfo } from './types';

export function getDashboardsApiVersion() {
  const forcingOldDashboardArch = locationService.getSearch().get('scenes') === 'false';

  // if dashboard scene is disabled, use legacy API response for the old architecture
  if (!config.featureToggles.dashboardScene || forcingOldDashboardArch) {
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
  obj?: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec | DashboardDataDTO> | null
): obj is DashboardWithAccessInfo<DashboardV2Spec> {
  if (!obj) {
    return false;
  }

  return 'kind' in obj && obj.kind === 'DashboardWithAccessInfo';
}

export function isDashboardV2Spec(obj: DashboardDataDTO | DashboardV2Spec): obj is DashboardV2Spec {
  return 'elements' in obj;
}

export function isDashboardV1Spec(obj: DashboardDataDTO | DashboardV2Spec): obj is DashboardDataDTO {
  return 'panels' in obj;
}

export function isDashboardV2Response(obj: DashboardWithAccessInfo<DashboardV2Spec | DashboardDataDTO>): obj is DashboardWithAccessInfo<DashboardV2Spec> {
  return obj != null && isDashboardV2Spec(obj.spec);
}

export function isDashboardV1Response(obj: DashboardWithAccessInfo<DashboardV2Spec | DashboardDataDTO>): obj is DashboardWithAccessInfo<DashboardDataDTO> {
  return obj != null && isDashboardV1Spec(obj.spec);
}

