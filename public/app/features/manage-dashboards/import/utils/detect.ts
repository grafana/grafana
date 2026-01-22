import { DashboardFormat } from 'app/features/dashboard/api/types';
import { isDashboardV1Resource, isDashboardV2Resource, isDashboardV2Spec } from 'app/features/dashboard/api/utils';

/**
 * Detect the dashboard format from input.
 * Handles k8s resources (v1/v2), raw specs, and classic dashboards.
 */
export function detectDashboardFormat(input: unknown): DashboardFormat {
  if (isDashboardV2Resource(input) || isDashboardV2Spec(input)) {
    return DashboardFormat.V2Resource;
  }

  if (isDashboardV1Resource(input)) {
    return DashboardFormat.V1Resource;
  }

  return DashboardFormat.Classic;
}

/**
 * Extract the dashboard spec from input, unwrapping k8s resources if needed.
 * Returns the spec for k8s resources, or the input unchanged for raw specs/classic dashboards.
 */
export function extractDashboardSpec(input: unknown): unknown {
  if (isDashboardV2Resource(input) || isDashboardV1Resource(input)) {
    return input.spec;
  }
  return input;
}
