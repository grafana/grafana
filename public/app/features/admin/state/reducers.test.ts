import { reducerTester } from 'test/core/redux/reducerTester';
import {
  clearUserErrorAction,
  clearUserMappingInfoAction,
  ldapConnectionInfoLoadedAction,
  ldapFailedAction,
  ldapReducer,
  ldapSyncStatusLoadedAction,
  ldapUserReducer,
  userLoadedAction,
  userMappingInfoFailedAction,
  userMappingInfoLoadedAction,
  userSessionsLoadedAction,
} from './reducers';
import { LdapState, LdapUser, LdapUserState, User } from 'app/types';

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
          userError: null,
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
          user: null,
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
          user: null,
        });
    });
  });
});

describe('Edit LDAP user page reducer', () => {
  describe('When user loaded', () => {
    it('should set user and clear user error', () => {
      const initialState = {
        ...makeInitialLdapUserState(),
        userError: {
          title: 'User not found',
          body: 'Cannot find user',
        },
      };

      reducerTester<LdapUserState>()
        .givenReducer(ldapUserReducer, initialState)
        .whenActionIsDispatched(userLoadedAction(getTestUser()))
        .thenStateShouldEqual({
          ...makeInitialLdapUserState(),
          user: getTestUser(),
          userError: null,
        });
    });
  });

  describe('when userSessionsLoadedAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<LdapUserState>()
        .givenReducer(ldapUserReducer, { ...makeInitialLdapUserState() })
        .whenActionIsDispatched(
          userSessionsLoadedAction([
            {
              browser: 'Chrome',
              id: 1,
              browserVersion: '79',
              clientIp: '127.0.0.1',
              createdAt: '2020-01-01 00:00:00',
              device: 'a device',
              isActive: true,
              os: 'MacOS',
              osVersion: '15',
              seenAt: '2020-01-01 00:00:00',
            },
          ])
        )
        .thenStateShouldEqual({
          ...makeInitialLdapUserState(),
          sessions: [
            {
              browser: 'Chrome',
              id: 1,
              browserVersion: '79',
              clientIp: '127.0.0.1',
              createdAt: '2020-01-01 00:00:00',
              device: 'a device',
              isActive: true,
              os: 'MacOS',
              osVersion: '15',
              seenAt: '2020-01-01 00:00:00',
            },
          ],
        });
    });
  });

  describe('when userMappingInfoLoadedAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<LdapUserState>()
        .givenReducer(ldapUserReducer, {
          ...makeInitialLdapUserState(),
        })
        .whenActionIsDispatched(userMappingInfoLoadedAction(getTestUserMapping()))
        .thenStateShouldEqual({
          ...makeInitialLdapUserState(),
          ldapUser: getTestUserMapping(),
        });
    });
  });

  describe('when userMappingInfoFailedAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<LdapUserState>()
        .givenReducer(ldapUserReducer, { ...makeInitialLdapUserState() })
        .whenActionIsDispatched(
          userMappingInfoFailedAction({
            title: 'User not found',
            body: 'Cannot find user',
          })
        )
        .thenStateShouldEqual({
          ...makeInitialLdapUserState(),
          userError: {
            title: 'User not found',
            body: 'Cannot find user',
          },
        });
    });
  });

  describe('when clearUserErrorAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<LdapUserState>()
        .givenReducer(ldapUserReducer, {
          ...makeInitialLdapUserState(),
          userError: {
            title: 'User not found',
            body: 'Cannot find user',
          },
        })
        .whenActionIsDispatched(clearUserErrorAction())
        .thenStateShouldEqual({
          ...makeInitialLdapUserState(),
          userError: null,
        });
    });
  });

  describe('when ldapSyncStatusLoadedAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<LdapUserState>()
        .givenReducer(ldapUserReducer, {
          ...makeInitialLdapUserState(),
        })
        .whenActionIsDispatched(
          ldapSyncStatusLoadedAction({
            enabled: true,
            schedule: '0 0 * * * *',
            nextSync: '2019-01-01T12:00:00Z',
          })
        )
        .thenStateShouldEqual({
          ...makeInitialLdapUserState(),
          ldapSyncInfo: {
            enabled: true,
            schedule: '0 0 * * * *',
            nextSync: '2019-01-01T12:00:00Z',
          },
        });
    });
  });
});
