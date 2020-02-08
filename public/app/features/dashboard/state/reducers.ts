import { Action } from 'redux';
import { DashboardInitPhase, DashboardState } from 'app/types';
import {
  cleanUpDashboard,
  dashboardInitCompleted,
  dashboardInitFailed,
  dashboardInitFetching,
  dashboardInitServices,
  dashboardInitSlow,
  loadDashboardPermissions,
  setDashboardQueriesToUpdate,
  clearDashboardQueriesToUpdate,
} from './actions';
import { processAclItems } from 'app/core/utils/acl';
import { panelEditorReducer } from '../panel_editor/state/reducers';
import { DashboardModel } from './DashboardModel';

export const initialState: DashboardState = {
  initPhase: DashboardInitPhase.NotStarted,
  isInitSlow: false,
  model: null,
  permissions: [],
  modifiedQueries: {
    panelId: undefined,
    queries: undefined,
  },
};

// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const dashboardReducer = (state: DashboardState = initialState, action: Action<unknown>): DashboardState => {
  if (loadDashboardPermissions.match(action)) {
    return {
      ...state,
      permissions: processAclItems(action.payload),
    };
  }

  if (dashboardInitFetching.match(action)) {
    return {
      ...state,
      initPhase: DashboardInitPhase.Fetching,
    };
  }

  if (dashboardInitServices.match(action)) {
    return {
      ...state,
      initPhase: DashboardInitPhase.Services,
    };
  }

  if (dashboardInitSlow.match(action)) {
    return {
      ...state,
      isInitSlow: true,
    };
  }

  if (dashboardInitFailed.match(action)) {
    return {
      ...state,
      initPhase: DashboardInitPhase.Failed,
      isInitSlow: false,
      initError: action.payload,
      model: new DashboardModel({ title: 'Dashboard init failed' }, { canSave: false, canEdit: false }),
    };
  }

  if (dashboardInitCompleted.match(action)) {
    return {
      ...state,
      initPhase: DashboardInitPhase.Completed,
      model: action.payload,
      isInitSlow: false,
    };
  }

  if (cleanUpDashboard.match(action)) {
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
  }

  if (setDashboardQueriesToUpdate.match(action)) {
    const { panelId, queries } = action.payload;

    return {
      ...state,
      modifiedQueries: {
        panelId,
        queries,
      },
    };
  }

  if (clearDashboardQueriesToUpdate.match(action)) {
    return {
      ...state,
      modifiedQueries: {
        panelId: undefined,
        queries: undefined,
      },
    };
  }

  return state;
};

export default {
  dashboard: dashboardReducer,
  panelEditor: panelEditorReducer,
};
