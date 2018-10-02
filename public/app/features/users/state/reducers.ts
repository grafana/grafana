import { Invitee, OrgUser, UsersState } from 'app/types';
import { Action, ActionTypes } from './actions';
import config from '../../../core/config';

export const initialState: UsersState = {
  invitees: [] as Invitee[],
  users: [] as OrgUser[],
  searchQuery: '',
  canInvite: !config.disableLoginForm && !config.externalUserMngLinkName,
  externalUserMngInfo: config.externalUserMngInfo,
  externalUserMngLinkName: config.externalUserMngLinkName,
  externalUserMngLinkUrl: config.externalUserMngLinkUrl,
};

export const usersReducer = (state = initialState, action: Action): UsersState => {
  switch (action.type) {
    case ActionTypes.LoadUsers:
      return { ...state, users: action.payload };

    case ActionTypes.LoadInvitees:
      return { ...state, invitees: action.payload };

    case ActionTypes.SetUsersSearchQuery:
      return { ...state, searchQuery: action.payload };
  }

  return state;
};

export default {
  users: usersReducer,
};
