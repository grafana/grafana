import { config, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardWithAccessInfo } from './types';

export const GRID_ROW_HEIGHT = 1;

export function getDashboardsApiVersion() {
  const forcingOldDashboardArch = locationService.getSearch().get('scenes') === 'false';

  // if dashboard scene is disabled, use legacy API response for the old architecture
  if (!config.featureToggles.dashboardScene || forcingOldDashboardArch) {
    // for old architecture, use v1 API for k8s dashboards
    if (config.featureToggles.kubernetesDashboards) {
      return 'v1';
    }

    return 'legacy';
  }

  if (config.featureToggles.useV2DashboardsAPI) {
    return 'v2';
  }

  if (config.featureToggles.kubernetesDashboards) {
    return 'v1';
  }

  return 'legacy';
}

// This function is used to determine if the dashboard is in v2 format or also v1 format
export function isDashboardResource(
  obj?: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec> | DashboardWithAccessInfo<DashboardDataDTO> | null
): obj is DashboardWithAccessInfo<DashboardV2Spec> | DashboardWithAccessInfo<DashboardDataDTO> {
  if (!obj) {
    return false;
  }
  // is v1 or v2 format?
  const isK8sDashboard = 'kind' in obj && obj.kind === 'DashboardWithAccessInfo';
  return isK8sDashboard;
}

export function isDashboardV2Spec(obj: Dashboard | DashboardDataDTO | DashboardV2Spec): obj is DashboardV2Spec {
  return 'elements' in obj;
}

export function isDashboardV0Spec(obj: DashboardDataDTO | DashboardV2Spec): obj is DashboardDataDTO {
  return !isDashboardV2Spec(obj); // not v2 spec means it's v1 spec
}

export function isDashboardV2Resource(
  obj: DashboardDTO | DashboardWithAccessInfo<DashboardDataDTO> | DashboardWithAccessInfo<DashboardV2Spec>
): obj is DashboardWithAccessInfo<DashboardV2Spec> {
  return isDashboardResource(obj) && isDashboardV2Spec(obj.spec);
}

export function isV1DashboardCommand(
  cmd: SaveDashboardCommand<Dashboard | DashboardV2Spec>
): cmd is SaveDashboardCommand<Dashboard> {
  return !isDashboardV2Spec(cmd.dashboard);
}

export function isV2DashboardCommand(
  cmd: SaveDashboardCommand<Dashboard | DashboardV2Spec>
): cmd is SaveDashboardCommand<DashboardV2Spec> {
  return isDashboardV2Spec(cmd.dashboard);
}
