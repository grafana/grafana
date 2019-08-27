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
        orgId: 1,
        orgRole: 'Admin',
      },
    ],
    teams: null,
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
