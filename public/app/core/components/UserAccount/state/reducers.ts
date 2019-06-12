import { OrgUser } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialState: object = {
  userProfile: {} as OrgUser,
};

export const userReducer = (state = initialState, action: Action): object => {
  switch (action.type) {
    case ActionTypes.LoadUserProfile:
      return { ...state, userProfile: action.payload };
  }

  return state;
};

export default {
  user: userReducer,
};
