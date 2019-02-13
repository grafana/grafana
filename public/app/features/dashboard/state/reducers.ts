import { DashboardState, DashboardInitPhase } from 'app/types';
import {
  loadDashboardPermissions,
  dashboardInitFetching,
  dashboardInitSlow,
  dashboardInitServices,
  dashboardInitFailed,
  dashboardInitCompleted,
  cleanUpDashboard,
} from './actions';
import { reducerFactory } from 'app/core/redux';
import { processAclItems } from 'app/core/utils/acl';
import { DashboardModel } from './DashboardModel';

export const initialState: DashboardState = {
  initPhase: DashboardInitPhase.NotStarted,
  isInitSlow: false,
  model: null,
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
    filter: dashboardInitFetching,
    mapper: state => ({
      ...state,
      initPhase: DashboardInitPhase.Fetching,
    }),
  })
  .addMapper({
    filter: dashboardInitServices,
    mapper: state => ({
      ...state,
      initPhase: DashboardInitPhase.Services,
    }),
  })
  .addMapper({
    filter: dashboardInitSlow,
    mapper: state => ({
      ...state,
      isInitSlow: true,
    }),
  })
  .addMapper({
    filter: dashboardInitFailed,
    mapper: (state, action) => ({
      ...state,
      initPhase: DashboardInitPhase.Failed,
      isInitSlow: false,
      initError: action.payload,
      model: new DashboardModel({ title: 'Dashboard init failed' }, { canSave: false, canEdit: false }),
    }),
  })
  .addMapper({
    filter: dashboardInitCompleted,
    mapper: (state, action) => ({
      ...state,
      initPhase: DashboardInitPhase.Completed,
      model: action.payload,
      isInitSlow: false,
    }),
  })
  .addMapper({
    filter: cleanUpDashboard,
    mapper: (state, action) => {
      // Destroy current DashboardModel
      // Very important as this removes all dashboard event listeners
      state.model.destroy();

      return {
        ...state,
        initPhase: DashboardInitPhase.NotStarted,
        model: null,
        isInitSlow: false,
        initError: null,
      };
    },
  })
  .create();

export default {
  dashboard: dashboardReducer,
};
