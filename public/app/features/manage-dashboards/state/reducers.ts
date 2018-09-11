import { DashboardListItem, ManageDashboardState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialState: ManageDashboardState = { listItems: [] as DashboardListItem[], searchQuery: '' };

export const manageDashboardsReducer = (state = initialState, action: Action): ManageDashboardState => {
  switch (action.type) {
    case ActionTypes.SearchDashboards:
      return { ...state, listItems: action.payload };
  }
  return state;
};

export default {
  manageDasboards: manageDashboardsReducer,
};
