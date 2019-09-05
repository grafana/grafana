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
  ldapError: {
    title: 'Did not find a user',
    body: 'User not found - try adjusting your search filters',
  },
  syncInfo: {
    enabled: true,
    scheduled: 'Once a week, between Saturday and Sunday',
    nextScheduled: 'Tomorrow',
    lastSync: 'Today',
  },
  user: {
    info: {
      name: {
        cfgAttrValue: 'givenName',
        ldapValue: 'peter',
      },
      surname: {
        cfgAttrValue: 'sn',
        ldapValue: 'h',
      },
      email: {
        cfgAttrValue: 'email',
        ldapValue: 'peterr@grafana.com',
      },
      login: {
        cfgAttrValue: 'cn',
        ldapValue: 'ldap-torkel',
      },
    },
    permissions: {
      isGrafanaAdmin: true,
      isDisabled: false,
    },
    roles: [
      {
        orgId: 'Maini org',
        orgRole: 'Admin',
        ldapAttribute: 'cn=admins,ou=groups,dc=grafana,dc=org',
      },
    ],
    teams: [
      {
        orgId: 'Main org',
        teamId: 'This Team',
        ldapAttribute: 'cn=other-not-matching,ou=groups,dc=grafana,dc=org',
      },
    ],
  },
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
