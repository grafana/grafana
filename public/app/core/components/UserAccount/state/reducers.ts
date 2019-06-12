import { OrgUser, UserAccountState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialState: UserAccountState = {
  userProfile: {} as OrgUser,
};

export const userAccountReducers = (state = initialState, action: Action): UserAccountState => {
  switch (action.type) {
    case ActionTypes.LoadUserProfile:
      return { ...state, userProfile: action.payload };

    case ActionTypes.SetUserName:
      return { ...state, userProfile: { ...state.userProfile, name: action.payload } };

    case ActionTypes.SetUserEmail:
      return { ...state, userProfile: { ...state.userProfile, email: action.payload } };

    case ActionTypes.SetUserLogin:
      return { ...state, userProfile: { ...state.userProfile, login: action.payload } };
  }

  return state;
};

export default {
  userAccount: userAccountReducers,
};
