import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { clearPredefinedVariablesCache } from 'app/features/dashboard-scene/utils/predefinedVariables';
import { dispatch } from 'app/store/store';

export const variableListTag = { type: 'Variable' as const, id: 'LIST' };

/**
 * Clears caches so dashboards pick up Variable CRUD without a hard refresh.
 * Owned by variables-management (mutation sites), not the API client veneer.
 */
export function invalidatePredefinedVariableCaches() {
  clearPredefinedVariablesCache();
  getDashboardScenePageStateManager().clearSceneCache();
}

export function invalidateAfterVariableMutation() {
  dispatch(dashboardAPIv2beta1.util.invalidateTags([variableListTag]));
  invalidatePredefinedVariableCaches();
}

/** Folder delete cascades Variables; drop the management-page list cache so it does not stay stale. */
export const invalidateVariablesAfterFolderDelete = invalidateAfterVariableMutation;
