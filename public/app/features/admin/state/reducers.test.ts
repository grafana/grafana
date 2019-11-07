import { Reducer } from 'redux';
import { reducerTester } from 'test/core/redux/reducerTester';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { ldapReducer, ldapUserReducer } from './reducers';
import {
  ldapConnectionInfoLoadedAction,
  ldapSyncStatusLoadedAction,
  userMappingInfoLoadedAction,
  userMappingInfoFailedAction,
  ldapFailedAction,
  userLoadedAction,
} from './actions';
import { LdapState, LdapUserState, LdapUser, User } from 'app/types';

const makeInitialLdapState = (): LdapState => ({
  connectionInfo: [],
  syncInfo: null,
  user: null,
  ldapError: null,
  connectionError: null,
  userError: null,
});

const makeInitialLdapUserState = (): LdapUserState => ({
  user: null,
  ldapUser: null,
  ldapSyncInfo: null,
  sessions: [],
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

const getTestUser = (): User => ({
  id: 1,
  email: 'user@localhost',
  login: 'user',
  name: 'User',
  avatarUrl: '',
  label: '',
});

describe('LDAP page reducer', () => {
  describe('When page loaded', () => {
    describe('When connection info loaded', () => {
      it('should set connection info and clear error', () => {
        const initalState = {
          ...makeInitialLdapState(),
        };

        reducerTester()
          .givenReducer(ldapReducer as Reducer<LdapState, ActionOf<any>>, initalState)
          .whenActionIsDispatched(
            ldapConnectionInfoLoadedAction([
              {
                available: true,
                host: 'localhost',
                port: 389,
                error: null,
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
                error: null,
              },
            ],
            ldapError: null,
          });
      });
    });

    describe('When connection failed', () => {
      it('should set ldap error', () => {
        const initalState = {
          ...makeInitialLdapState(),
        };

        reducerTester()
          .givenReducer(ldapReducer as Reducer<LdapState, ActionOf<any>>, initalState)
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
        const initalState = {
          ...makeInitialLdapState(),
        };

        reducerTester()
          .givenReducer(ldapReducer as Reducer<LdapState, ActionOf<any>>, initalState)
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
      const initalState = {
        ...makeInitialLdapState(),
        userError: {
          title: 'User not found',
          body: 'Cannot find user',
        },
      };

      reducerTester()
        .givenReducer(ldapReducer as Reducer<LdapState, ActionOf<any>>, initalState)
        .whenActionIsDispatched(userMappingInfoLoadedAction(getTestUserMapping()))
        .thenStateShouldEqual({
          ...makeInitialLdapState(),
          user: getTestUserMapping(),
          userError: null,
        });
    });
  });

  describe('When user not found', () => {
    it('should set user error and clear user info', () => {
      const initalState = {
        ...makeInitialLdapState(),
        user: getTestUserMapping(),
      };

      reducerTester()
        .givenReducer(ldapReducer as Reducer<LdapState, ActionOf<any>>, initalState)
        .whenActionIsDispatched(
          userMappingInfoFailedAction({
            title: 'User not found',
            body: 'Cannot find user',
          })
        )
        .thenStateShouldEqual({
          ...makeInitialLdapState(),
          user: null,
          userError: {
            title: 'User not found',
            body: 'Cannot find user',
          },
        });
    });
  });
});

describe('Edit LDAP user page reducer', () => {
  describe('When user loaded', () => {
    it('should set user and clear user error', () => {
      const initalState = {
        ...makeInitialLdapUserState(),
        userError: {
          title: 'User not found',
          body: 'Cannot find user',
        },
      };

      reducerTester()
        .givenReducer(ldapUserReducer as Reducer<LdapUserState, ActionOf<any>>, initalState)
        .whenActionIsDispatched(userLoadedAction(getTestUser()))
        .thenStateShouldEqual({
          ...makeInitialLdapUserState(),
          user: getTestUser(),
          userError: null,
        });
    });
  });
});
