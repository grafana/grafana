import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { LdapState, LdapConnectionInfo, LdapError, SyncInfo, LdapUser } from 'app/types/ldap';
import {
  UserAdminState,
  UserDTO,
  UserOrg,
  UserSession,
  UserAdminError,
  UserListAdminState,
  UserFilter,
  UserListAnonymousDevicesState,
  UserAnonymousDeviceDTO,
  AnonUserFilter,
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

// UserAdminPage

const initialUserAdminState: UserAdminState = {
  user: undefined,
  sessions: [],
  orgs: [],
  isLoading: true,
  error: undefined,
};

export const userAdminSlice = createSlice({
  name: 'userAdmin',
  initialState: initialUserAdminState,
  reducers: {
    userProfileLoadedAction: (state, action: PayloadAction<UserDTO>): UserAdminState => ({
      ...state,
      user: action.payload,
    }),
    userOrgsLoadedAction: (state, action: PayloadAction<UserOrg[]>): UserAdminState => ({
      ...state,
      orgs: action.payload,
    }),
    userSessionsLoadedAction: (state, action: PayloadAction<UserSession[]>): UserAdminState => ({
      ...state,
      sessions: action.payload,
    }),
    userAdminPageLoadedAction: (state, action: PayloadAction<boolean>): UserAdminState => ({
      ...state,
      isLoading: !action.payload,
    }),
    userAdminPageFailedAction: (state, action: PayloadAction<UserAdminError>): UserAdminState => ({
      ...state,
      error: action.payload,
      isLoading: false,
    }),
  },
});

export const {
  userProfileLoadedAction,
  userOrgsLoadedAction,
  userSessionsLoadedAction,
  userAdminPageLoadedAction,
  userAdminPageFailedAction,
} = userAdminSlice.actions;

export const userAdminReducer = userAdminSlice.reducer;

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

export const userListAdminSlice = createSlice({
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

export const userListAnonymousDevicesSlice = createSlice({
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
export const userListAnonymousDevicesReducer = userListAnonymousDevicesSlice.reducer;

export default {
  ldap: ldapReducer,
  userAdmin: userAdminReducer,
  userListAdmin: userListAdminReducer,
  userListAnonymousDevices: userListAnonymousDevicesReducer,
};
