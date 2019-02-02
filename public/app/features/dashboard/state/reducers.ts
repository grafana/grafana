import { DashboardState, DashboardLoadingState } from 'app/types/dashboard';
import { loadDashboardPermissions, setDashboardLoadingState } from './actions';
import { reducerFactory } from 'app/core/redux';
import { processAclItems } from 'app/core/utils/acl';

export const initialState: DashboardState = {
  loadingState: DashboardLoadingState.NotStarted,
  dashboard: null,
  permissions: [],
};

export const dashboardReducer = reducerFactory(initialState)
  .addMapper({
    filter: loadDashboardPermissions,
    mapper: (state, action) => ({
      ...state,
      permissions: processAclItems(action.payload),
    }),
  })
  .addMapper({
    filter: setDashboardLoadingState,
    mapper: (state, action) => ({
      ...state,
      loadingState: action.payload
    }),
  })
  .create()

export default {
  dashboard: dashboardReducer,
};
