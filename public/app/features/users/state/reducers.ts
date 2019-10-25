import { Invitee, OrgUser, UsersState } from 'app/types';
import { Action, ActionTypes } from './actions';
import config from 'app/core/config';

export const initialState: UsersState = {
  invitees: [] as Invitee[],
  users: [] as OrgUser[],
  searchQuery: '',
  canInvite: !config.externalUserMngLinkName,
  externalUserMngInfo: config.externalUserMngInfo,
  externalUserMngLinkName: config.externalUserMngLinkName,
  externalUserMngLinkUrl: config.externalUserMngLinkUrl,
  hasFetched: false,
};

export const usersReducer = (state = initialState, action: Action): UsersState => {
  switch (action.type) {
    case ActionTypes.LoadUsers:
      return { ...state, hasFetched: true, users: action.payload };

    case ActionTypes.LoadInvitees:
      return { ...state, hasFetched: true, invitees: action.payload };

    case ActionTypes.SetUsersSearchQuery:
      return { ...state, searchQuery: action.payload };
  }

  return state;
};

export default {
  users: usersReducer,
};
