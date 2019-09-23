import { reducerFactory } from 'app/core/redux';
import { LdapState, LdapUserState } from 'app/types';
import {
  ldapConnectionInfoLoadedAction,
  ldapFailedAction,
  userMappingInfoLoadedAction,
  userMappingInfoFailedAction,
  clearUserErrorAction,
  userLoadedAction,
  userSessionsLoadedAction,
  ldapSyncStatusLoadedAction,
  clearUserMappingInfoAction,
} from './actions';

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

export const ldapReducer = reducerFactory(initialLdapState)
  .addMapper({
    filter: ldapConnectionInfoLoadedAction,
    mapper: (state, action) => ({
      ...state,
      ldapError: null,
      connectionInfo: action.payload,
    }),
  })
  .addMapper({
    filter: ldapFailedAction,
    mapper: (state, action) => ({
      ...state,
      ldapError: action.payload,
    }),
  })
  .addMapper({
    filter: ldapSyncStatusLoadedAction,
    mapper: (state, action) => ({
      ...state,
      syncInfo: action.payload,
    }),
  })
  .addMapper({
    filter: userMappingInfoLoadedAction,
    mapper: (state, action) => ({
      ...state,
      user: action.payload,
      userError: null,
    }),
  })
  .addMapper({
    filter: userMappingInfoFailedAction,
    mapper: (state, action) => ({
      ...state,
      user: null,
      userError: action.payload,
    }),
  })
  .addMapper({
    filter: clearUserMappingInfoAction,
    mapper: (state, action) => ({
      ...state,
      user: null,
    }),
  })
  .addMapper({
    filter: clearUserErrorAction,
    mapper: state => ({
      ...state,
      userError: null,
    }),
  })
  .create();

export const ldapUserReducer = reducerFactory(initialLdapUserState)
  .addMapper({
    filter: userMappingInfoLoadedAction,
    mapper: (state, action) => ({
      ...state,
      ldapUser: action.payload,
    }),
  })
  .addMapper({
    filter: userMappingInfoFailedAction,
    mapper: (state, action) => ({
      ...state,
      ldapUser: null,
      userError: action.payload,
    }),
  })
  .addMapper({
    filter: clearUserErrorAction,
    mapper: state => ({
      ...state,
      userError: null,
    }),
  })
  .addMapper({
    filter: ldapSyncStatusLoadedAction,
    mapper: (state, action) => ({
      ...state,
      ldapSyncInfo: action.payload,
    }),
  })
  .addMapper({
    filter: userLoadedAction,
    mapper: (state, action) => ({
      ...state,
      user: action.payload,
      userError: null,
    }),
  })
  .addMapper({
    filter: userSessionsLoadedAction,
    mapper: (state, action) => ({
      ...state,
      sessions: action.payload,
    }),
  })
  .create();

export default {
  ldap: ldapReducer,
  ldapUser: ldapUserReducer,
};
