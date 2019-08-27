import { reducerFactory } from 'app/core/redux';
import { LdapState } from 'app/types';
import { testLdapMapping } from './actions';

const initialState: LdapState = {
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
  .create();

export default {
  ldap: ldapReducer,
};
