import { DashboardState } from 'app/types';
import { Action, ActionTypes } from './actions';
import { processAclItems } from 'app/core/utils/acl';

export const initialState: DashboardState = {
  permissions: [],
};

export const dashboardReducer = (state = initialState, action: Action): DashboardState => {
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
