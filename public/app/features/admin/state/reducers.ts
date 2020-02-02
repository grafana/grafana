import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  LdapConnectionInfo,
  LdapError,
  LdapState,
  LdapUser,
  SyncInfo,
  UserAdminError,
  UserAdminState,
  UserDTO,
  UserOrg,
  UserSession,
} from 'app/types';

const initialLdapState: LdapState = {
  connectionInfo: [],
  syncInfo: null,
  user: null,
  connectionError: null,
  userError: null,
};

const ldapSlice = createSlice({
  name: 'ldap',
  initialState: initialLdapState,
  reducers: {
    ldapConnectionInfoLoadedAction: (state, action: PayloadAction<LdapConnectionInfo>): LdapState => ({
      ...state,
      ldapError: null,
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
      userError: null,
    }),
    userMappingInfoFailedAction: (state, action: PayloadAction<LdapError>): LdapState => ({
      ...state,
      user: null,
      userError: action.payload,
    }),
    clearUserMappingInfoAction: (state, action: PayloadAction<undefined>): LdapState => ({
      ...state,
      user: null,
    }),
    clearUserErrorAction: (state, action: PayloadAction<undefined>): LdapState => ({
      ...state,
      userError: null,
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
  user: null,
  sessions: [],
  orgs: [],
  isLoading: true,
  error: null,
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

export default {
  ldap: ldapReducer,
  userAdmin: userAdminReducer,
};
