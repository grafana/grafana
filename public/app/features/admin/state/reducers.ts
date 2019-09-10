import { reducerFactory } from 'app/core/redux';
import { LdapState, LdapUserState } from 'app/types';
import {
  ldapConnectionInfoLoadedAction,
  userInfoLoadedAction,
  userInfoFailedAction,
  clearUserError,
  userLoadedAction,
  userSessionsLoadedAction,
  ldapSyncStatusLoadedAction,
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
  sessions: [],
};

const ldapReducer = reducerFactory(initialLdapState)
  .addMapper({
    filter: ldapConnectionInfoLoadedAction,
    mapper: (state, action) => ({
      ...state,
      connectionInfo: action.payload,
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
    filter: userInfoLoadedAction,
    mapper: (state, action) => ({
      ...state,
      user: action.payload,
    }),
  })
  .addMapper({
    filter: userInfoFailedAction,
    mapper: (state, action) => ({
      ...state,
      user: null,
      userError: action.payload,
    }),
  })
  .addMapper({
    filter: clearUserError,
    mapper: state => ({
      ...state,
      userError: null,
    }),
  })
  .create();

const ldapUserReducer = reducerFactory(initialLdapUserState)
  .addMapper({
    filter: userInfoLoadedAction,
    mapper: (state, action) => ({
      ...state,
      ldapUser: action.payload,
    }),
  })
  .addMapper({
    filter: userInfoFailedAction,
    mapper: (state, action) => ({
      ...state,
      ldapUser: null,
      userError: action.payload,
    }),
  })
  .addMapper({
    filter: clearUserError,
    mapper: state => ({
      ...state,
      userError: null,
    }),
  })
  .addMapper({
    filter: userLoadedAction,
    mapper: (state, action) => ({
      ...state,
      user: action.payload,
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
