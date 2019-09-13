import { Invitee, OrgUser, UsersState } from 'app/types';
import config from 'app/core/config';
import { reducerFactory } from '../../../core/redux';
import { usersLoaded, inviteesLoaded, setUsersSearchQuery } from './actions';

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

export const usersReducer = reducerFactory<UsersState>(initialState)
  .addMapper({
    filter: usersLoaded,
    mapper: (state, action): UsersState => ({ ...state, hasFetched: true, users: action.payload.users }),
  })
  .addMapper({
    filter: inviteesLoaded,
    mapper: (state, action): UsersState => ({ ...state, hasFetched: true, invitees: action.payload.invitees }),
  })
  .addMapper({
    filter: setUsersSearchQuery,
    mapper: (state, action): UsersState => ({ ...state, hasFetched: true, searchQuery: action.payload.query }),
  })
  .create({ resetStateForPath: '/org/users' });

export default {
  users: usersReducer,
};
