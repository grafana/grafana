import { __assign } from "tslib";
import { reducerTester } from 'test/core/redux/reducerTester';
import { clearUserMappingInfoAction, ldapConnectionInfoLoadedAction, ldapFailedAction, ldapReducer, ldapSyncStatusLoadedAction, userAdminReducer, userMappingInfoFailedAction, userMappingInfoLoadedAction, userProfileLoadedAction, userSessionsLoadedAction, userListAdminReducer, queryChanged, } from './reducers';
var makeInitialLdapState = function () { return ({
    connectionInfo: [],
}); };
var makeInitialUserAdminState = function () { return ({
    sessions: [],
    orgs: [],
    isLoading: true,
}); };
var makeInitialUserListAdminState = function () { return ({
    users: [],
    query: '',
    page: 0,
    perPage: 50,
    totalPages: 1,
    showPaging: false,
    filters: [{ name: 'activeLast30Days', value: true }],
    isLoading: false,
}); };
var getTestUserMapping = function () { return ({
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
}); };
var getTestUser = function () { return ({
    id: 1,
    email: 'user@localhost',
    login: 'user',
    name: 'User',
    avatarUrl: '',
    isGrafanaAdmin: false,
    isDisabled: false,
}); };
describe('LDAP page reducer', function () {
    describe('When page loaded', function () {
        describe('When connection info loaded', function () {
            it('should set connection info and clear error', function () {
                var initialState = __assign({}, makeInitialLdapState());
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
                    .thenStateShouldEqual(__assign(__assign({}, makeInitialLdapState()), { connectionInfo: [
                        {
                            available: true,
                            host: 'localhost',
                            port: 389,
                            error: null,
                        },
                    ], ldapError: undefined }));
            });
        });
        describe('When connection failed', function () {
            it('should set ldap error', function () {
                var initialState = __assign({}, makeInitialLdapState());
                reducerTester()
                    .givenReducer(ldapReducer, initialState)
                    .whenActionIsDispatched(ldapFailedAction({
                    title: 'LDAP error',
                    body: 'Failed to connect',
                }))
                    .thenStateShouldEqual(__assign(__assign({}, makeInitialLdapState()), { ldapError: {
                        title: 'LDAP error',
                        body: 'Failed to connect',
                    } }));
            });
        });
        describe('When LDAP sync status loaded', function () {
            it('should set sync info', function () {
                var initialState = __assign({}, makeInitialLdapState());
                reducerTester()
                    .givenReducer(ldapReducer, initialState)
                    .whenActionIsDispatched(ldapSyncStatusLoadedAction({
                    enabled: true,
                    schedule: '0 0 * * * *',
                    nextSync: '2019-01-01T12:00:00Z',
                }))
                    .thenStateShouldEqual(__assign(__assign({}, makeInitialLdapState()), { syncInfo: {
                        enabled: true,
                        schedule: '0 0 * * * *',
                        nextSync: '2019-01-01T12:00:00Z',
                    } }));
            });
        });
    });
    describe('When user mapping info loaded', function () {
        it('should set sync info and clear user error', function () {
            var initialState = __assign(__assign({}, makeInitialLdapState()), { userError: {
                    title: 'User not found',
                    body: 'Cannot find user',
                } });
            reducerTester()
                .givenReducer(ldapReducer, initialState)
                .whenActionIsDispatched(userMappingInfoLoadedAction(getTestUserMapping()))
                .thenStateShouldEqual(__assign(__assign({}, makeInitialLdapState()), { user: getTestUserMapping(), userError: undefined }));
        });
    });
    describe('When user not found', function () {
        it('should set user error and clear user info', function () {
            var initialState = __assign(__assign({}, makeInitialLdapState()), { user: getTestUserMapping() });
            reducerTester()
                .givenReducer(ldapReducer, initialState)
                .whenActionIsDispatched(userMappingInfoFailedAction({
                title: 'User not found',
                body: 'Cannot find user',
            }))
                .thenStateShouldEqual(__assign(__assign({}, makeInitialLdapState()), { user: undefined, userError: {
                    title: 'User not found',
                    body: 'Cannot find user',
                } }));
        });
    });
    describe('when clearUserMappingInfoAction is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(ldapReducer, __assign(__assign({}, makeInitialLdapState()), { user: getTestUserMapping() }))
                .whenActionIsDispatched(clearUserMappingInfoAction())
                .thenStateShouldEqual(__assign(__assign({}, makeInitialLdapState()), { user: undefined }));
        });
    });
});
describe('Edit Admin user page reducer', function () {
    describe('When user loaded', function () {
        it('should set user and clear user error', function () {
            var initialState = __assign({}, makeInitialUserAdminState());
            reducerTester()
                .givenReducer(userAdminReducer, initialState)
                .whenActionIsDispatched(userProfileLoadedAction(getTestUser()))
                .thenStateShouldEqual(__assign(__assign({}, makeInitialUserAdminState()), { user: getTestUser() }));
        });
    });
    describe('when userSessionsLoadedAction is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(userAdminReducer, __assign({}, makeInitialUserAdminState()))
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
                .thenStateShouldEqual(__assign(__assign({}, makeInitialUserAdminState()), { sessions: [
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
describe('User List Admin reducer', function () {
    describe('When query changed', function () {
        it('should reset page to 0', function () {
            var initialState = __assign(__assign({}, makeInitialUserListAdminState()), { page: 3 });
            reducerTester()
                .givenReducer(userListAdminReducer, initialState)
                .whenActionIsDispatched(queryChanged('test'))
                .thenStateShouldEqual(__assign(__assign({}, makeInitialUserListAdminState()), { query: 'test', page: 0 }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map