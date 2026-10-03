import { reducerTester } from 'test/core/redux/reducerTester';

import { type LdapState, type LdapUser } from 'app/types/ldap';
import { type UserListAdminState } from 'app/types/user';

import {
  clearUserMappingInfoAction,
  ldapConnectionInfoLoadedAction,
  ldapFailedAction,
  ldapReducer,
  ldapSyncStatusLoadedAction,
  userMappingInfoFailedAction,
  userMappingInfoLoadedAction,
  userListAdminReducer,
  queryChanged,
  filterChanged,
} from './reducers';

const makeInitialLdapState = (): LdapState => ({
  connectionInfo: [],
});

const makeInitialUserListAdminState = (): UserListAdminState => ({
  users: [],
  query: '',
  page: 0,
  perPage: 50,
  totalPages: 1,
  showPaging: false,
  filters: [{ name: 'activeLast30Days', value: true }],
  isLoading: false,
});

const getTestUserMapping = (): LdapUser => ({
  info: {
    email: { cfgAttrValue: 'mail', ldapValue: 'user@localhost' },
    name: { cfgAttrValue: 'givenName', ldapValue: 'User' },
    surname: { cfgAttrValue: 'sn', ldapValue: '' },
    login: { cfgAttrValue: 'cn', ldapValue: 'user' },
  },
  permissions: {
    isGrafanaAdmin: false,
    isDisabled: false,
  },
  roles: [],
  teams: [],
});

describe('LDAP page reducer', () => {
  describe('When page loaded', () => {
    describe('When connection info loaded', () => {
      it('should set connection info and clear error', () => {
        const initialState = {
          ...makeInitialLdapState(),
        };

        reducerTester<LdapState>()
          .givenReducer(ldapReducer, initialState)
          .whenActionIsDispatched(
            ldapConnectionInfoLoadedAction([
              {
                available: true,
                host: 'localhost',
                port: 389,
                error: null as unknown as string,
              },
            ])
          )
          .thenStateShouldEqual({
            ...makeInitialLdapState(),
            connectionInfo: [
              {
                available: true,
                host: 'localhost',
                port: 389,
                error: null as unknown as string,
              },
            ],
            ldapError: undefined,
          });
      });
    });

    describe('When connection failed', () => {
      it('should set ldap error', () => {
        const initialState = {
          ...makeInitialLdapState(),
        };

        reducerTester<LdapState>()
          .givenReducer(ldapReducer, initialState)
          .whenActionIsDispatched(
            ldapFailedAction({
              title: 'LDAP error',
              body: 'Failed to connect',
            })
          )
          .thenStateShouldEqual({
            ...makeInitialLdapState(),
            ldapError: {
              title: 'LDAP error',
              body: 'Failed to connect',
            },
          });
      });
    });

    describe('When LDAP sync status loaded', () => {
      it('should set sync info', () => {
        const initialState = {
          ...makeInitialLdapState(),
        };

        reducerTester<LdapState>()
          .givenReducer(ldapReducer, initialState)
          .whenActionIsDispatched(
            ldapSyncStatusLoadedAction({
              enabled: true,
              schedule: '0 0 * * * *',
              nextSync: '2019-01-01T12:00:00Z',
            })
          )
          .thenStateShouldEqual({
            ...makeInitialLdapState(),
            syncInfo: {
              enabled: true,
              schedule: '0 0 * * * *',
              nextSync: '2019-01-01T12:00:00Z',
            },
          });
      });
    });
  });

  describe('When user mapping info loaded', () => {
    it('should set sync info and clear user error', () => {
      const initialState = {
        ...makeInitialLdapState(),
        userError: {
          title: 'User not found',
          body: 'Cannot find user',
        },
      };

      reducerTester<LdapState>()
        .givenReducer(ldapReducer, initialState)
        .whenActionIsDispatched(userMappingInfoLoadedAction(getTestUserMapping()))
        .thenStateShouldEqual({
          ...makeInitialLdapState(),
          user: getTestUserMapping(),
          userError: undefined,
        });
    });
  });

  describe('When user not found', () => {
    it('should set user error and clear user info', () => {
      const initialState = {
        ...makeInitialLdapState(),
        user: getTestUserMapping(),
      };

      reducerTester<LdapState>()
        .givenReducer(ldapReducer, initialState)
        .whenActionIsDispatched(
          userMappingInfoFailedAction({
            title: 'User not found',
            body: 'Cannot find user',
          })
        )
        .thenStateShouldEqual({
          ...makeInitialLdapState(),
          user: undefined,
          userError: {
            title: 'User not found',
            body: 'Cannot find user',
          },
        });
    });
  });

  describe('when clearUserMappingInfoAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<LdapState>()
        .givenReducer(ldapReducer, {
          ...makeInitialLdapState(),
          user: getTestUserMapping(),
        })
        .whenActionIsDispatched(clearUserMappingInfoAction())
        .thenStateShouldEqual({
          ...makeInitialLdapState(),
          user: undefined,
        });
    });
  });
});

describe('User List Admin reducer', () => {
  describe('When query changed', () => {
    it('should reset page to 0', () => {
      const initialState = {
        ...makeInitialUserListAdminState(),
        page: 3,
      };

      reducerTester<UserListAdminState>()
        .givenReducer(userListAdminReducer, initialState)
        .whenActionIsDispatched(queryChanged('test'))
        .thenStateShouldEqual({
          ...makeInitialUserListAdminState(),
          query: 'test',
          page: 0,
        });
    });
  });

  describe('When filter changed', () => {
    it('should reset page to 0', () => {
      const initialState = {
        ...makeInitialUserListAdminState(),
        page: 3,
      };

      reducerTester<UserListAdminState>()
        .givenReducer(userListAdminReducer, initialState)
        .whenActionIsDispatched(filterChanged({ test: true }))
        .thenStateShouldEqual({
          ...makeInitialUserListAdminState(),
          page: 0,
          filters: expect.arrayContaining([{ test: true }]),
        });
    });
  });
});
