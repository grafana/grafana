import { Reducer } from 'redux';
import { reducerTester } from 'test/core/redux/reducerTester';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { ldapReducer } from './reducers';
import {
  ldapConnectionInfoLoadedAction,
  ldapSyncStatusLoadedAction,
  userMappingInfoLoadedAction,
  userMappingInfoFailedAction,
  ldapFailedAction,
} from './actions';
import { LdapState, LdapUser } from 'app/types/ldap';

const makeInitialLdapState = (): LdapState => ({
  connectionInfo: [],
  syncInfo: null,
  user: null,
  ldapError: null,
  connectionError: null,
  userError: null,
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
