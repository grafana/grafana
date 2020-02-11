import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Invitee, OrgUser, UsersState } from 'app/types';
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

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    usersLoaded: (state, action: PayloadAction<OrgUser[]>): UsersState => {
      return { ...state, hasFetched: true, users: action.payload };
    },
    inviteesLoaded: (state, action: PayloadAction<Invitee[]>): UsersState => {
      return { ...state, hasFetched: true, invitees: action.payload };
    },
    setUsersSearchQuery: (state, action: PayloadAction<string>): UsersState => {
      return { ...state, searchQuery: action.payload };
    },
  },
});

export const { inviteesLoaded, setUsersSearchQuery, usersLoaded } = usersSlice.actions;

export const usersReducer = usersSlice.reducer;

export default {
  users: usersReducer,
};
