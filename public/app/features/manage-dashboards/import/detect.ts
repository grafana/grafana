import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Dashboard } from '@grafana/schema/dist/esm/veneer/dashboard.types';

export type ImportModel = 'classic' | 'v1-resource' | 'v2-resource';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if unknown is a V2 dashboard spec
 */
export function isDashboardV2Spec(value: unknown): value is DashboardV2Spec {
  if (!isRecord(value)) {
    return false;
  }
  // V2 dashboards have elements, or have variables/annotations with the v2 kind structure
  const hasElements = 'elements' in value;
  const hasV2Variables =
    Array.isArray(value.variables) && value.variables.some((v: unknown) => isRecord(v) && 'kind' in v);
  const hasV2Annotations =
    Array.isArray(value.annotations) && value.annotations.some((a: unknown) => isRecord(a) && 'kind' in a);
  return hasElements || hasV2Variables || hasV2Annotations;
}

/**
 * Type guard to check if unknown is a V1 dashboard
 */
export function isDashboardV1Spec(value: unknown): value is Dashboard {
  if (!isRecord(value)) {
    return false;
  }
  // V1 dashboards have title and are NOT v2
  return 'title' in value && !isDashboardV2Spec(value);
}

/**
 * Check if value is a V2 resource wrapper (has spec.elements)
 */
export function isV2Resource(dashboard: unknown): boolean {
  return isRecord(dashboard) && isRecord(dashboard.spec) && 'elements' in dashboard.spec;
}

/**
 * Extract V1 resource spec from a resource wrapper
 */
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

/**
 * Detect the import model type from a dashboard
 */
export function detectImportModel(dashboard: unknown): ImportModel {
  if (isV2Resource(dashboard) || isDashboardV2Spec(dashboard)) {
    return 'v2-resource';
  }

  if (getV1ResourceSpec(dashboard)) {
    return 'v1-resource';
  }

  return 'classic';
}
