import { UserState } from 'app/types';
import { Action, ActionTypes } from 'app/core/components/UserEdit/state/actions';
import config from 'app/core/config';
import { OrgUser } from 'app/types';

export const initialState: UserState = {
  orgId: config.bootData.user.orgId,
  timeZone: config.bootData.user.timezone,
  profile: {} as OrgUser,
};

export const userReducer = (state = initialState, action: Action): UserState => {
  switch (action.type) {
    case ActionTypes.LoadUser:
      return { ...state, profile: action.payload };

    case ActionTypes.SetUserName:
      return { ...state, profile: { ...state.profile, name: action.payload } };

    case ActionTypes.SetUserEmail:
      return { ...state, profile: { ...state.profile, email: action.payload } };

    case ActionTypes.SetUserLogin:
      return { ...state, profile: { ...state.profile, login: action.payload } };
  }
  return state;
};

export default {
  user: userReducer,
};
