import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import config from 'app/core/config';
import { OrgUser, UsersState } from 'app/types';

export const initialState: UsersState = {
  users: [] as OrgUser[],
  searchQuery: '',
  searchPage: 1,
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
    setUsersSearchQuery: (state, action: PayloadAction<string>): UsersState => {
      // reset searchPage otherwise search results won't appear
      return { ...state, searchQuery: action.payload, searchPage: initialState.searchPage };
    },
    setUsersSearchPage: (state, action: PayloadAction<number>): UsersState => {
      return { ...state, searchPage: action.payload };
    },
  },
});

export const { setUsersSearchQuery, setUsersSearchPage, usersLoaded } = usersSlice.actions;

export const usersReducer = usersSlice.reducer;

export default {
  users: usersReducer,
};
