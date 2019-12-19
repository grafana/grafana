import { reducerFactory } from 'app/core/redux';
import { LdapState, UserAdminState } from 'app/types';
import {
  ldapConnectionInfoLoadedAction,
  ldapFailedAction,
  userMappingInfoLoadedAction,
  userMappingInfoFailedAction,
  clearUserErrorAction,
  userAdminPageLoadedAction,
  userSessionsLoadedAction,
  ldapSyncStatusLoadedAction,
  clearUserMappingInfoAction,
  userProfileLoadedAction,
  userOrgsLoadedAction,
  userAdminPageFailedAction,
} from './actions';

const initialLdapState: LdapState = {
  connectionInfo: [],
  syncInfo: null,
  user: null,
  connectionError: null,
  userError: null,
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

// UserAdminPage

const initialUserAdminState: UserAdminState = {
  user: null,
  sessions: [],
  orgs: [],
  isLoading: true,
};

export const userAdminReducer = reducerFactory(initialUserAdminState)
  .addMapper({
    filter: userProfileLoadedAction,
    mapper: (state, action) => ({
      ...state,
      user: action.payload,
    }),
  })
  .addMapper({
    filter: userOrgsLoadedAction,
    mapper: (state, action) => ({
      ...state,
      orgs: action.payload,
    }),
  })
  .addMapper({
    filter: userSessionsLoadedAction,
    mapper: (state, action) => ({
      ...state,
      sessions: action.payload,
    }),
  })
  .addMapper({
    filter: userAdminPageLoadedAction,
    mapper: (state, action) => ({
      ...state,
      isLoading: !action.payload,
    }),
  })
  .addMapper({
    filter: userAdminPageFailedAction,
    mapper: (state, action) => ({
      ...state,
      error: action.payload,
      isLoading: false,
    }),
  })
  .create();

export default {
  ldap: ldapReducer,
  userAdmin: userAdminReducer,
};
