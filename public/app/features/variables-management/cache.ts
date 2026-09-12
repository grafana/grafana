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

/**
 * Folder delete cascades Variables, so the management-page list must refetch.
 * Unlike variable CRUD, this does not clear dashboard scene caches: dashboards
 * in the deleted folder are gone, and remaining scenes do not use those folder variables.
 */
export function invalidateVariablesAfterFolderDelete() {
  dispatch(dashboardAPIv2beta1.util.invalidateTags([variableListTag]));
}
