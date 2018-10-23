import { DashboardState } from 'app/types';
import { Action, ActionTypes } from './actions';
import { processAclItems } from 'app/core/utils/acl';

export const inititalState: DashboardState = {
  permissions: [],
};

export const dashboardReducer = (state = inititalState, action: Action): DashboardState => {
  switch (action.type) {
    case ActionTypes.LoadDashboardPermissions:
      return {
        ...state,
        permissions: processAclItems(action.payload),
      };
  }
  return state;
};

export default {
  dashboard: dashboardReducer,
};
