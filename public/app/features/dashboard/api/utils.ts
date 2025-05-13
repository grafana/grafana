import { config, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardWithAccessInfo } from './types';

export function getDashboardsApiVersion(responseFormat?: 'v1' | 'v2') {
  const isDashboardSceneEnabled = config.featureToggles.dashboardScene;
  const isKubernetesDashboardsEnabled = config.featureToggles.kubernetesDashboards;
  const forcingOldDashboardArch = locationService.getSearch().get('scenes') === 'false';

  // Force legacy API when dashboard scene is disabled or explicitly forced
  if (!isDashboardSceneEnabled || forcingOldDashboardArch) {
    if (responseFormat === 'v2') {
      throw new Error('v2 is not supported for legacy architecture');
    }

    return isKubernetesDashboardsEnabled ? 'v1' : 'legacy';
  }

  // Unified manages redirection between v1 and v2, but when responseFormat is undefined we get the unified API
  if (isKubernetesDashboardsEnabled) {
    if (responseFormat === 'v1') {
      return 'v1';
    }
    if (responseFormat === 'v2') {
      return 'v2';
    }
    return 'unified';
  }

  // Handle non-kubernetes case
  if (responseFormat === 'v2') {
    throw new Error('v2 is not supported if kubernetes dashboards are disabled');
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
