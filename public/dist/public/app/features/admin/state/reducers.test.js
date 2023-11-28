import { reducerTester } from 'test/core/redux/reducerTester';
import { clearUserMappingInfoAction, ldapConnectionInfoLoadedAction, ldapFailedAction, ldapReducer, ldapSyncStatusLoadedAction, userAdminReducer, userMappingInfoFailedAction, userMappingInfoLoadedAction, userProfileLoadedAction, userSessionsLoadedAction, userListAdminReducer, queryChanged, filterChanged, } from './reducers';
const makeInitialLdapState = () => ({
    connectionInfo: [],
});
const makeInitialUserAdminState = () => ({
    sessions: [],
    orgs: [],
    isLoading: true,
});
const makeInitialUserListAdminState = () => ({
    users: [],
    query: '',
    page: 0,
    perPage: 50,
    totalPages: 1,
    showPaging: false,
    filters: [{ name: 'activeLast30Days', value: true }],
    isLoading: false,
});
const getTestUserMapping = () => ({
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
const getTestUser = () => ({
    id: 1,
    email: 'user@localhost',
    login: 'user',
    name: 'User',
    avatarUrl: '',
    isGrafanaAdmin: false,
    isDisabled: false,
});
describe('LDAP page reducer', () => {
    describe('When page loaded', () => {
        describe('When connection info loaded', () => {
            it('should set connection info and clear error', () => {
                const initialState = Object.assign({}, makeInitialLdapState());
                reducerTester()
                    .givenReducer(ldapReducer, initialState)
                    .whenActionIsDispatched(ldapConnectionInfoLoadedAction([
                    {
                        available: true,
                        host: 'localhost',
                        port: 389,
                        error: null,
                    },
                ]))
                    .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialLdapState()), { connectionInfo: [
                        {
                            available: true,
                            host: 'localhost',
                            port: 389,
                            error: null,
                        },
                    ], ldapError: undefined }));
            });
        });
        describe('When connection failed', () => {
            it('should set ldap error', () => {
                const initialState = Object.assign({}, makeInitialLdapState());
                reducerTester()
                    .givenReducer(ldapReducer, initialState)
                    .whenActionIsDispatched(ldapFailedAction({
                    title: 'LDAP error',
                    body: 'Failed to connect',
                }))
                    .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialLdapState()), { ldapError: {
                        title: 'LDAP error',
                        body: 'Failed to connect',
                    } }));
            });
        });
        describe('When LDAP sync status loaded', () => {
            it('should set sync info', () => {
                const initialState = Object.assign({}, makeInitialLdapState());
                reducerTester()
                    .givenReducer(ldapReducer, initialState)
                    .whenActionIsDispatched(ldapSyncStatusLoadedAction({
                    enabled: true,
                    schedule: '0 0 * * * *',
                    nextSync: '2019-01-01T12:00:00Z',
                }))
                    .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialLdapState()), { syncInfo: {
                        enabled: true,
                        schedule: '0 0 * * * *',
                        nextSync: '2019-01-01T12:00:00Z',
                    } }));
            });
        });
    });
    describe('When user mapping info loaded', () => {
        it('should set sync info and clear user error', () => {
            const initialState = Object.assign(Object.assign({}, makeInitialLdapState()), { userError: {
                    title: 'User not found',
                    body: 'Cannot find user',
                } });
            reducerTester()
                .givenReducer(ldapReducer, initialState)
                .whenActionIsDispatched(userMappingInfoLoadedAction(getTestUserMapping()))
                .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialLdapState()), { user: getTestUserMapping(), userError: undefined }));
        });
    });
    describe('When user not found', () => {
        it('should set user error and clear user info', () => {
            const initialState = Object.assign(Object.assign({}, makeInitialLdapState()), { user: getTestUserMapping() });
            reducerTester()
                .givenReducer(ldapReducer, initialState)
                .whenActionIsDispatched(userMappingInfoFailedAction({
                title: 'User not found',
                body: 'Cannot find user',
            }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialLdapState()), { user: undefined, userError: {
                    title: 'User not found',
                    body: 'Cannot find user',
                } }));
        });
    });
    describe('when clearUserMappingInfoAction is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(ldapReducer, Object.assign(Object.assign({}, makeInitialLdapState()), { user: getTestUserMapping() }))
                .whenActionIsDispatched(clearUserMappingInfoAction())
                .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialLdapState()), { user: undefined }));
        });
    });
});
describe('Edit Admin user page reducer', () => {
    describe('When user loaded', () => {
        it('should set user and clear user error', () => {
            const initialState = Object.assign({}, makeInitialUserAdminState());
            reducerTester()
                .givenReducer(userAdminReducer, initialState)
                .whenActionIsDispatched(userProfileLoadedAction(getTestUser()))
                .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialUserAdminState()), { user: getTestUser() }));
        });
    });
    describe('when userSessionsLoadedAction is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(userAdminReducer, Object.assign({}, makeInitialUserAdminState()))
                .whenActionIsDispatched(userSessionsLoadedAction([
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
            ]))
                .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialUserAdminState()), { sessions: [
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
                ] }));
        });
    });
});
describe('User List Admin reducer', () => {
    describe('When query changed', () => {
        it('should reset page to 0', () => {
            const initialState = Object.assign(Object.assign({}, makeInitialUserListAdminState()), { page: 3 });
            reducerTester()
                .givenReducer(userListAdminReducer, initialState)
                .whenActionIsDispatched(queryChanged('test'))
                .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialUserListAdminState()), { query: 'test', page: 0 }));
        });
    });
    describe('When filter changed', () => {
        it('should reset page to 0', () => {
            const initialState = Object.assign(Object.assign({}, makeInitialUserListAdminState()), { page: 3 });
            reducerTester()
                .givenReducer(userListAdminReducer, initialState)
                .whenActionIsDispatched(filterChanged({ test: true }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, makeInitialUserListAdminState()), { page: 0, filters: expect.arrayContaining([{ test: true }]) }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map