import { config, locationService } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Status, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as DashboardV3alpha0Spec } from '@grafana/schema/apis/dashboard.grafana.app/v3alpha0';
import { isRecord } from 'app/core/utils/isRecord';
import { AnnoKeyGrantPermissions, type Resource, type ResourceForCreate } from 'app/features/apiserver/types';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { type SaveDashboardCommand } from '../components/SaveDashboard/types';

import { dashboardAPIVersionResolver } from './DashboardAPIVersionResolver';
import { type DashboardWithAccessInfo } from './types';

export function isV2StoredVersion(version: string | undefined): boolean {
  return version === 'v2alpha1' || version === 'v2beta1' || version === 'v2';
}

export function isV0V1StoredVersion(version: string | undefined): boolean {
  return version === 'v0alpha1' || version === 'v1alpha1' || version === 'v1beta1' || version === 'v1';
}

export function isV3StoredVersion(version: string | undefined): boolean {
  return version === 'v3alpha0';
}

export function getDashboardsApiVersion(responseFormat?: 'v1' | 'v2' | 'v3alpha0') {
  const isKubernetesDashboardsEnabled = config.featureToggles.kubernetesDashboards;
  const isDashboardNewLayoutsEnabled = config.featureToggles.dashboardNewLayouts;

  const forcingOldDashboardArch = locationService.getSearch().get('scenes') === 'false';

  // Force legacy API when dashboard scene is force disabled
  if (forcingOldDashboardArch) {
    if (responseFormat === 'v2' || responseFormat === 'v3alpha0') {
      throw new Error(`${responseFormat} is not supported for legacy architecture`);
    }

    return isKubernetesDashboardsEnabled ? 'v1' : 'legacy';
  }

  // v3alpha0 is only available when the backend advertises it AND the
  // dashboardRules feature toggle is on. The resolver bakes the toggle in.
  if (responseFormat === 'v3alpha0') {
    if (!isKubernetesDashboardsEnabled) {
      throw new Error('v3alpha0 requires kubernetes dashboards to be enabled');
    }
    if (!dashboardAPIVersionResolver.isV3Available()) {
      throw new Error(
        'v3alpha0 is not available — requires the dashboardRules feature toggle and a backend that serves v3alpha0'
      );
    }
    return 'v3alpha0';
  }

  // Unified manages redirection between v1 and v2, but when responseFormat is undefined we get the unified API
  if (isKubernetesDashboardsEnabled) {
    if (responseFormat === 'v1') {
      return 'v1';
    }
    if (responseFormat === 'v2' || isDashboardNewLayoutsEnabled) {
      // When dashboardRules is on and the server advertises v3alpha0, use v3alpha0 as the
      // default read/write path. v3alpha0 is a structural superset of v2 (rules field optional),
      // so rule-free dashboards round-trip identically while rule-bearing dashboards stay native.
      if (config.featureToggles.dashboardRules && dashboardAPIVersionResolver.isV3Available()) {
        return 'v3alpha0';
      }
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

/**
 * Structural check — v2 and v3alpha0 both carry `elements`. v3 adds `rules`
 * on top; call isDashboardV3Spec to narrow to the rules-bearing shape.
 */
export function isDashboardV2Spec(obj: unknown): obj is DashboardV2Spec {
  return isRecord(obj) && 'elements' in obj;
}

/**
 * Structural predicate — true when the spec matches the v3alpha0 shape.
 * v3alpha0 adds an optional `rules` array on top of v2, so any spec carrying
 * a (possibly empty) `rules` array is a v3alpha0 spec. Save-path routing
 * policy (e.g. empty-rules dashboards going through v2) lives in
 * isV3DashboardCommand, not here.
 */
export function isDashboardV3Spec(obj: unknown): obj is DashboardV3alpha0Spec {
  if (!isDashboardV2Spec(obj)) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const rules = (obj as DashboardV3alpha0Spec).rules;
  return Array.isArray(rules);
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
  cmd: SaveDashboardCommand<Dashboard | DashboardV2Spec | DashboardV3alpha0Spec>
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
  cmd: SaveDashboardCommand<Dashboard | DashboardV2Spec | DashboardV3alpha0Spec>
): cmd is SaveDashboardCommand<DashboardV2Spec> {
  return isDashboardV2Spec(cmd.dashboard) && !isV3DashboardCommand(cmd);
}

/**
 * Save-path policy: route to the v3alpha0 client only when the spec carries
 * at least one rule. Dashboards with an empty `rules: []` round-trip safely
 * through v2, so we keep them on v2 storage to avoid advertising v3 unnecessarily.
 */
export function isV3DashboardCommand(
  cmd: SaveDashboardCommand<Dashboard | DashboardV2Spec | DashboardV3alpha0Spec>
): cmd is SaveDashboardCommand<DashboardV3alpha0Spec> {
  if (!isDashboardV3Spec(cmd.dashboard)) {
    return false;
  }
  return (cmd.dashboard.rules?.length ?? 0) > 0;
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
