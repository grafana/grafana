import { reducerFactory } from 'app/core/redux';
import { LdapState } from 'app/types';
import { testLdapMapping } from './actions';

const initialState: LdapState = {
  user: {
    name: {
      cfgAttrValue: 'givenName',
      ldapValue: 'ldap-torkel',
    },
    surname: {
      cfgAttrValue: 'sn',
      ldapValue: 'ldap-torkel',
    },
    email: {
      cfgAttrValue: 'email',
      ldapValue: '',
    },
    login: {
      cfgAttrValue: 'cn',
      ldapValue: 'ldap-torkel',
    },
    isGrafanaAdmin: true,
    isDisabled: false,
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
