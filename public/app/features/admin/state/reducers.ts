import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { type LdapState, type LdapConnectionInfo, type LdapError, type SyncInfo, type LdapUser } from 'app/types/ldap';
import {
  type UserDTO,
  type UserListAdminState,
  type UserFilter,
  type UserListAnonymousDevicesState,
  type UserAnonymousDeviceDTO,
  type AnonUserFilter,
} from 'app/types/user';

const initialLdapState: LdapState = {
  connectionInfo: [],
  syncInfo: undefined,
  user: undefined,
  connectionError: undefined,
  userError: undefined,
};

const ldapSlice = createSlice({
  name: 'ldap',
  initialState: initialLdapState,
  reducers: {
    ldapConnectionInfoLoadedAction: (state, action: PayloadAction<LdapConnectionInfo>): LdapState => ({
      ...state,
      ldapError: undefined,
      connectionInfo: action.payload,
    }),
    ldapFailedAction: (state, action: PayloadAction<LdapError>): LdapState => ({
      ...state,
      ldapError: action.payload,
    }),
    ldapSyncStatusLoadedAction: (state, action: PayloadAction<SyncInfo>): LdapState => ({
      ...state,
      syncInfo: action.payload,
    }),
    userMappingInfoLoadedAction: (state, action: PayloadAction<LdapUser>): LdapState => ({
      ...state,
      user: action.payload,
      userError: undefined,
    }),
    userMappingInfoFailedAction: (state, action: PayloadAction<LdapError>): LdapState => ({
      ...state,
      user: undefined,
      userError: action.payload,
    }),
    clearUserMappingInfoAction: (state, action: PayloadAction<undefined>): LdapState => ({
      ...state,
      user: undefined,
    }),
    clearUserErrorAction: (state, action: PayloadAction<undefined>): LdapState => ({
      ...state,
      userError: undefined,
    }),
  },
});

export const {
  clearUserErrorAction,
  clearUserMappingInfoAction,
  ldapConnectionInfoLoadedAction,
  ldapFailedAction,
  ldapSyncStatusLoadedAction,
  userMappingInfoFailedAction,
  userMappingInfoLoadedAction,
} = ldapSlice.actions;

export const ldapReducer = ldapSlice.reducer;

// UserListAdminPage

const initialUserListAdminState: UserListAdminState = {
  users: [],
  query: '',
  page: 0,
  perPage: 50,
  totalPages: 1,
  showPaging: false,
  filters: [{ name: 'activeLast30Days', value: false }],
  isLoading: true,
};

interface UsersFetched {
  users: UserDTO[];
  perPage: number;
  page: number;
  totalCount: number;
}

const userListAdminSlice = createSlice({
  name: 'userListAdmin',
  initialState: initialUserListAdminState,
  reducers: {
    usersFetched: (state, action: PayloadAction<UsersFetched>) => {
      const { totalCount, perPage, ...rest } = action.payload;
      const totalPages = Math.ceil(totalCount / perPage);

      return {
        ...state,
        ...rest,
        totalPages,
        perPage,
        showPaging: totalPages > 1,
        isLoading: false,
      };
    },
    usersFetchBegin: (state) => {
      return { ...state, isLoading: true };
    },
    usersFetchEnd: (state) => {
      return { ...state, isLoading: false };
    },
    queryChanged: (state, action: PayloadAction<string>) => ({
      ...state,
      query: action.payload,
      page: 0,
    }),
    pageChanged: (state, action: PayloadAction<number>) => ({
      ...state,
      page: action.payload,
    }),
    sortChanged: (state, action: PayloadAction<UserListAdminState['sort']>) => ({
      ...state,
      page: 0,
      sort: action.payload,
    }),
    filterChanged: (state, action: PayloadAction<UserFilter>) => {
      const { name, value } = action.payload;

      if (state.filters.some((filter) => filter.name === name)) {
        return {
          ...state,
          page: 0,
          filters: state.filters.map((filter) => (filter.name === name ? { ...filter, value } : filter)),
        };
      }
      return {
        ...state,
        page: 0,
        filters: [...state.filters, action.payload],
      };
    },
  },
});

export const { usersFetched, usersFetchBegin, usersFetchEnd, queryChanged, pageChanged, filterChanged, sortChanged } =
  userListAdminSlice.actions;
export const userListAdminReducer = userListAdminSlice.reducer;

// UserListAnonymousPage

const initialUserListAnonymousDevicesState: UserListAnonymousDevicesState = {
  devices: [],
  query: '',
  page: 0,
  perPage: 50,
  totalPages: 1,
  showPaging: false,
  filters: [{ name: 'activeLast30Days', value: true }],
};

interface UsersAnonymousDevicesFetched {
  devices: UserAnonymousDeviceDTO[];
  perPage: number;
  page: number;
  totalCount: number;
}

const userListAnonymousDevicesSlice = createSlice({
  name: 'userListAnonymousDevices',
  initialState: initialUserListAnonymousDevicesState,
  reducers: {
    usersAnonymousDevicesFetched: (state, action: PayloadAction<UsersAnonymousDevicesFetched>) => {
      const { totalCount, perPage, ...rest } = action.payload;
      const totalPages = Math.ceil(totalCount / perPage);

      return {
        ...state,
        ...rest,
        totalPages,
        perPage,
        showPaging: totalPages > 1,
      };
    },
    anonQueryChanged: (state, action: PayloadAction<string>) => ({
      ...state,
      query: action.payload,
      page: 0,
    }),
    anonPageChanged: (state, action: PayloadAction<number>) => ({
      ...state,
      page: action.payload,
    }),
    anonUserSortChanged: (state, action: PayloadAction<UserListAnonymousDevicesState['sort']>) => ({
      ...state,
      page: 0,
      sort: action.payload,
    }),
    filterChanged: (state, action: PayloadAction<AnonUserFilter>) => {
      const { name, value } = action.payload;

      if (state.filters.some((filter) => filter.name === name)) {
        return {
          ...state,
          page: 0,
          filters: state.filters.map((filter) => (filter.name === name ? { ...filter, value } : filter)),
        };
      }
      return {
        ...state,
        page: 0,
        filters: [...state.filters, action.payload],
      };
    },
  },
});

export const { usersAnonymousDevicesFetched, anonUserSortChanged, anonPageChanged, anonQueryChanged } =
  userListAnonymousDevicesSlice.actions;
const userListAnonymousDevicesReducer = userListAnonymousDevicesSlice.reducer;

export default {
  ldap: ldapReducer,
  userListAdmin: userListAdminReducer,
  userListAnonymousDevices: userListAnonymousDevicesReducer,
};
