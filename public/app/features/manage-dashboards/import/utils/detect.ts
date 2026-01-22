import { isDashboardV1Resource, isDashboardV2Resource, isDashboardV2Spec } from 'app/features/dashboard/api/utils';

export type ImportModel = 'classic' | 'v1-resource' | 'v2-resource';

/**
 * Detect the import model type from a dashboard
 */
export function detectImportModel(dashboard: unknown): ImportModel {
  if (isDashboardV2Resource(dashboard) || isDashboardV2Spec(dashboard)) {
    return 'v2-resource';
  }

  if (isDashboardV1Resource(dashboard)) {
    return 'v1-resource';
  }

  return 'classic';
}
