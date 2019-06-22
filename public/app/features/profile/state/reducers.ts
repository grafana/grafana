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
  }
  return state;
};

export default {
  user: userReducer,
};
