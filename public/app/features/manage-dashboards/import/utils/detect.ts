import { isDashboardV2Spec, isV1Resource, isV2Resource } from 'app/features/dashboard/api/utils';

export type ImportModel = 'classic' | 'v1-resource' | 'v2-resource';

/**
 * Detect the import model type from a dashboard
 */
export function detectImportModel(dashboard: unknown): ImportModel {
  if (isV2Resource(dashboard) || isDashboardV2Spec(dashboard)) {
    return 'v2-resource';
  }

  if (isV1Resource(dashboard)) {
    return 'v1-resource';
  }

  return 'classic';
}
