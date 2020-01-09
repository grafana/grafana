import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  LdapConnectionInfo,
  LdapError,
  LdapState,
  LdapUser,
  LdapUserState,
  SyncInfo,
  User,
  UserSession,
} from 'app/types';

const initialLdapState: LdapState = {
  connectionInfo: [],
  syncInfo: null,
  user: null,
  connectionError: null,
  userError: null,
};

const initialLdapUserState: LdapUserState = {
  user: null,
  ldapUser: null,
  ldapSyncInfo: null,
  sessions: [],
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

const ldapUserSlice = createSlice({
  name: 'ldapUser',
  initialState: initialLdapUserState,
  reducers: {
    userLoadedAction: (state, action: PayloadAction<User>): LdapUserState => ({
      ...state,
      user: action.payload,
      userError: null,
    }),
    userSessionsLoadedAction: (state, action: PayloadAction<UserSession[]>): LdapUserState => ({
      ...state,
      sessions: action.payload,
    }),
    userSyncFailedAction: (state, action: PayloadAction<undefined>): LdapUserState => state,
  },
  extraReducers: builder =>
    builder
      .addCase(
        userMappingInfoLoadedAction,
        (state, action): LdapUserState => ({
          ...state,
          ldapUser: action.payload,
        })
      )
      .addCase(
        userMappingInfoFailedAction,
        (state, action): LdapUserState => ({
          ...state,
          ldapUser: null,
          userError: action.payload,
        })
      )
      .addCase(
        clearUserErrorAction,
        (state, action): LdapUserState => ({
          ...state,
          userError: null,
        })
      )
      .addCase(
        ldapSyncStatusLoadedAction,
        (state, action): LdapUserState => ({
          ...state,
          ldapSyncInfo: action.payload,
        })
      ),
});

export const { userLoadedAction, userSessionsLoadedAction, userSyncFailedAction } = ldapUserSlice.actions;

export const ldapUserReducer = ldapUserSlice.reducer;

export default {
  ldap: ldapReducer,
  ldapUser: ldapUserReducer,
};
