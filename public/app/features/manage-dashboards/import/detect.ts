import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';

export type ImportModel = 'classic' | 'v1-resource' | 'v2-resource';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isV2Resource(dashboard: unknown): boolean {
  return isRecord(dashboard) && isRecord(dashboard.spec) && 'elements' in dashboard.spec;
}

export function isV2Spec(dashboard: unknown): dashboard is DashboardV2Spec {
  if (!isRecord(dashboard)) {
    return false;
  }
  // V2 dashboards have elements, or have variables/annotations with the v2 kind structure
  const hasElements = 'elements' in dashboard;
  const hasV2Variables =
    Array.isArray(dashboard.variables) && dashboard.variables.some((v: unknown) => isRecord(v) && 'kind' in v);
  const hasV2Annotations =
    Array.isArray(dashboard.annotations) && dashboard.annotations.some((a: unknown) => isRecord(a) && 'kind' in a);
  return hasElements || hasV2Variables || hasV2Annotations;
}

export function getV1ResourceSpec(dashboard: unknown): Record<string, unknown> | undefined {
  if (!isRecord(dashboard)) {
    return undefined;
  }

  if (!('spec' in dashboard)) {
    return undefined;
  }

  const spec = dashboard.spec;
  if (isRecord(spec) && 'elements' in spec) {
    return undefined;
  }

  if (isRecord(spec)) {
    return spec;
  }

  return undefined;
}

export function detectImportModel(dashboard: unknown): ImportModel {
  if (isV2Resource(dashboard) || isV2Spec(dashboard)) {
    return 'v2-resource';
  }

  if (getV1ResourceSpec(dashboard)) {
    return 'v1-resource';
  }

  return 'classic';
}

/**
 * Type guard to narrow Dashboard | DashboardV2Spec to DashboardV2Spec based on model
 */
export function isV2Dashboard(
  model: ImportModel,
  dashboard: Dashboard | DashboardV2Spec
): dashboard is DashboardV2Spec {
  return model === 'v2-resource';
}

/**
 * Type guard to narrow Dashboard | DashboardV2Spec to Dashboard based on model
 */
export function isV1Dashboard(model: ImportModel, dashboard: Dashboard | DashboardV2Spec): dashboard is Dashboard {
  return model !== 'v2-resource';
}
