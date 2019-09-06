import { reducerFactory } from 'app/core/redux';
import { LdapState } from 'app/types';
import {
  clearError,
  testLdapMapping,
  ldapConnectionInfoLoadedAction,
  userInfoLoadedAction,
  userInfoFailedAction,
  clearUserError,
} from './actions';

const initialState: LdapState = {
  connectionInfo: [],
  syncInfo: {
    enabled: true,
    scheduled: 'Once a week, between Saturday and Sunday',
    nextScheduled: 'Tomorrow',
    lastSync: 'Today',
  },
  user: null,
  ldapError: null,
  connectionError: null,
};

const ldapReducer = reducerFactory(initialState)
  .addMapper({
    filter: testLdapMapping,
    mapper: (state, action) => ({
      ...state,
      ...action.payload,
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
  .addMapper({
    filter: ldapConnectionInfoLoadedAction,
    mapper: (state, action) => ({
      ...state,
      connectionInfo: action.payload,
    }),
  })
  .addMapper({
    filter: clearError,
    mapper: state => ({
      ...state,
      ldapError: null,
    }),
  })
  .create();

export default {
  ldap: ldapReducer,
};
