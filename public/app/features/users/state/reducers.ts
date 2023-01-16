import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import config from 'app/core/config';
import { OrgUser, UsersState } from 'app/types';

export const initialState: UsersState = {
  users: [] as OrgUser[],
  searchQuery: '',
  page: 0,
  perPage: 30,
  totalPages: 1,
  canInvite: !config.externalUserMngLinkName,
  externalUserMngInfo: config.externalUserMngInfo,
  externalUserMngLinkName: config.externalUserMngLinkName,
  externalUserMngLinkUrl: config.externalUserMngLinkUrl,
  isLoading: false,
};

export interface UsersFetchResult {
  orgUsers: OrgUser[];
  perPage: number;
  page: number;
  totalCount: number;
}

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    usersLoaded: (state, action: PayloadAction<UsersFetchResult>): UsersState => {
      const { totalCount, perPage, page, orgUsers } = action.payload;
      const totalPages = Math.ceil(totalCount / perPage);

      return {
        ...state,
        isLoading: true,
        users: orgUsers,
        perPage,
        page,
        totalPages,
      };
    },
    searchQueryChanged: (state, action: PayloadAction<string>): UsersState => {
      // reset searchPage otherwise search results won't appear
      return { ...state, searchQuery: action.payload, page: initialState.page };
    },
    setUsersSearchPage: (state, action: PayloadAction<number>): UsersState => {
      return { ...state, page: action.payload };
    },
    pageChanged: (state, action: PayloadAction<number>) => ({
      ...state,
      page: action.payload,
    }),
    usersFetchBegin: (state) => {
      return { ...state, isLoading: true };
    },
    usersFetchEnd: (state) => {
      return { ...state, isLoading: false };
    },
  },
});

export const { searchQueryChanged, setUsersSearchPage, usersLoaded, usersFetchBegin, usersFetchEnd, pageChanged } =
  usersSlice.actions;

export const usersReducer = usersSlice.reducer;

export default {
  users: usersReducer,
};
