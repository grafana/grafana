import { DashboardSearchHit, UserState } from '../../types';
import { Action, ActionTypes } from '../actions/user';

const initialState: UserState = {
  starredDashboards: [] as DashboardSearchHit[],
};

export const userReducer = (state: UserState = initialState, action: Action): UserState => {
  switch (action.type) {
    case ActionTypes.LoadStarredDashboards:
      return { ...state, starredDashboards: action.payload };
  }

  return state;
};
