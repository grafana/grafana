import { config, locationService } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Status, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isRecord } from 'app/core/utils/isRecord';
import { AnnoKeyGrantPermissions, type Resource, type ResourceForCreate } from 'app/features/apiserver/types';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { type SaveDashboardCommand } from '../components/SaveDashboard/types';

import { type DashboardWithAccessInfo } from './types';

export function isV2StoredVersion(version: string | undefined): boolean {
  return version === 'v2alpha1' || version === 'v2beta1' || version === 'v2';
}

export function isV0V1StoredVersion(version: string | undefined): boolean {
  return version === 'v0alpha1' || version === 'v1alpha1' || version === 'v1beta1' || version === 'v1';
}

export function getDashboardsApiVersion(responseFormat?: 'v1' | 'v2') {
  const isKubernetesDashboardsEnabled = config.featureToggles.kubernetesDashboards;
  const isDashboardNewLayoutsEnabled = config.featureToggles.dashboardNewLayouts;

  const forcingOldDashboardArch = locationService.getSearch().get('scenes') === 'false';

  // console.log(forcingOldDashboardArch);
  // Force legacy API when dashboard scene is force disabled
  if (forcingOldDashboardArch) {
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
    if (responseFormat === 'v2' || isDashboardNewLayoutsEnabled) {
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

// This function is used to determine if the dashboard is a k8s resource (v1 or v2 format)
export function isDashboardResource(
  value: unknown
): value is DashboardWithAccessInfo<DashboardV2Spec> | DashboardWithAccessInfo<DashboardDataDTO> {
  return (
    isRecord(value) && (value.kind === 'DashboardWithAccessInfo' || value.kind === 'Dashboard') && isRecord(value.spec)
  );
}

export function isDashboardV2Spec(obj: unknown): obj is DashboardV2Spec {
  return isRecord(obj) && 'elements' in obj;
}

export function isDashboardV1Spec(obj: unknown): obj is Dashboard {
  return isRecord(obj) && 'title' in obj && !isDashboardV2Spec(obj);
}

export function isDashboardV0Spec(obj: DashboardDataDTO | DashboardV2Spec): obj is DashboardDataDTO {
  return !isDashboardV2Spec(obj);
}

export function isDashboardV2Resource(value: unknown): value is DashboardWithAccessInfo<DashboardV2Spec> {
  return isDashboardResource(value) && isDashboardV2Spec(value.spec);
}

export function isV1DashboardCommand(
  cmd: SaveDashboardCommand<Dashboard | DashboardV2Spec>
): cmd is SaveDashboardCommand<Dashboard> {
  return !isDashboardV2Spec(cmd.dashboard);
}

export function isV1ClassicDashboard(obj: Dashboard | DashboardV2Spec): obj is Dashboard {
  return !isDashboardV2Spec(obj);
}

export function isDashboardV1Resource(value: unknown): value is DashboardWithAccessInfo<DashboardDataDTO> {
  return isDashboardResource(value) && !isDashboardV2Spec(value.spec);
}

export function isV2DashboardCommand(
  cmd: SaveDashboardCommand<Dashboard | DashboardV2Spec>
): cmd is SaveDashboardCommand<DashboardV2Spec> {
  return isDashboardV2Spec(cmd.dashboard);
}

export function buildRestorePayload<T>(dashboard: Resource<T>): ResourceForCreate<T> {
  return {
    metadata: {
      ...dashboard.metadata,
      resourceVersion: '',
      annotations: {
        ...dashboard.metadata.annotations,
        [AnnoKeyGrantPermissions]: 'default',
      },
    },
    spec: dashboard.spec,
  };
}

/**
 * Helper function to extract the stored version from a dashboard resource if conversion failed
 * @param item - Dashboard resource item
 * @returns The stored version string if conversion failed, undefined otherwise
 */
export function getFailedVersion(
  item: Resource<Dashboard | DashboardV2Spec | DashboardDataDTO, Status>
): string | undefined {
  return item.status?.conversion?.failed ? item.status.conversion.storedVersion : undefined;
}

/**
 * Helper function to check if a dashboard resource has a failed conversion from specific versions
 * @param item - Dashboard resource item
 * @param versionPrefixes - Array of version prefixes to check (e.g., ['v1', 'v2'])
 * @returns True if conversion failed and stored version starts with any of the specified prefixes
 */
export function failedFromVersion(
  item: Resource<Dashboard | DashboardV2Spec | DashboardDataDTO, Status>,
  versionPrefixes: string[]
): boolean {
  const storedVersion = getFailedVersion(item);
  return !!storedVersion && versionPrefixes.some((prefix) => storedVersion.startsWith(prefix));
}
