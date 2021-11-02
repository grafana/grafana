import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { OrgRole, TeamPermissionLevel } from '../../../types';
import { initialUserState, orgsLoaded, sessionsLoaded, setUpdating, teamsLoaded, updateTimeZone, updateWeekStart, userLoaded, userReducer, userSessionRevoked, } from './reducers';
describe('userReducer', function () {
    var dateNow;
    beforeAll(function () {
        dateNow = jest.spyOn(Date, 'now').mockImplementation(function () { return 1609470000000; }); // 2021-01-01 04:00:00
    });
    afterAll(function () {
        dateNow.mockRestore();
    });
    describe('when updateTimeZone is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(userReducer, __assign({}, initialUserState))
                .whenActionIsDispatched(updateTimeZone({ timeZone: 'xyz' }))
                .thenStateShouldEqual(__assign(__assign({}, initialUserState), { timeZone: 'xyz' }));
        });
    });
    describe('when updateWeekStart is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(userReducer, __assign({}, initialUserState))
                .whenActionIsDispatched(updateWeekStart({ weekStart: 'xyz' }))
                .thenStateShouldEqual(__assign(__assign({}, initialUserState), { weekStart: 'xyz' }));
        });
    });
    describe('when setUpdating is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(userReducer, __assign(__assign({}, initialUserState), { isUpdating: false }))
                .whenActionIsDispatched(setUpdating({ updating: true }))
                .thenStateShouldEqual(__assign(__assign({}, initialUserState), { isUpdating: true }));
        });
    });
    describe('when userLoaded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(userReducer, __assign(__assign({}, initialUserState), { user: null }))
                .whenActionIsDispatched(userLoaded({
                user: {
                    id: 2021,
                    email: 'test@test.com',
                    isDisabled: true,
                    login: 'test',
                    name: 'Test Account',
                    isGrafanaAdmin: false,
                },
            }))
                .thenStateShouldEqual(__assign(__assign({}, initialUserState), { user: {
                    id: 2021,
                    email: 'test@test.com',
                    isDisabled: true,
                    login: 'test',
                    name: 'Test Account',
                    isGrafanaAdmin: false,
                } }));
        });
    });
    describe('when teamsLoaded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(userReducer, __assign(__assign({}, initialUserState), { teamsAreLoading: true }))
                .whenActionIsDispatched(teamsLoaded({
                teams: [
                    {
                        id: 1,
                        email: 'team@team.com',
                        name: 'Team',
                        avatarUrl: '/avatar/12345',
                        memberCount: 4,
                        permission: TeamPermissionLevel.Admin,
                    },
                ],
            }))
                .thenStateShouldEqual(__assign(__assign({}, initialUserState), { teamsAreLoading: false, teams: [
                    {
                        id: 1,
                        email: 'team@team.com',
                        name: 'Team',
                        avatarUrl: '/avatar/12345',
                        memberCount: 4,
                        permission: TeamPermissionLevel.Admin,
                    },
                ] }));
        });
    });
    describe('when orgsLoaded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(userReducer, __assign(__assign({}, initialUserState), { orgsAreLoading: true }))
                .whenActionIsDispatched(orgsLoaded({
                orgs: [{ orgId: 1, name: 'Main', role: OrgRole.Viewer }],
            }))
                .thenStateShouldEqual(__assign(__assign({}, initialUserState), { orgsAreLoading: false, orgs: [{ orgId: 1, name: 'Main', role: OrgRole.Viewer }] }));
        });
    });
    describe('when sessionsLoaded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(userReducer, __assign(__assign({}, initialUserState), { sessionsAreLoading: true }))
                .whenActionIsDispatched(sessionsLoaded({
                sessions: [
                    {
                        id: 1,
                        browser: 'Chrome',
                        browserVersion: '90',
                        osVersion: '95',
                        clientIp: '192.168.1.1',
                        createdAt: '2021-01-01 04:00:00',
                        device: 'Computer',
                        os: 'Windows',
                        isActive: false,
                        seenAt: '1996-01-01 04:00:00',
                    },
                ],
            }))
                .thenStateShouldEqual(__assign(__assign({}, initialUserState), { sessionsAreLoading: false, sessions: [
                    {
                        id: 1,
                        browser: 'Chrome',
                        browserVersion: '90',
                        osVersion: '95',
                        clientIp: '192.168.1.1',
                        createdAt: 'December 31, 2020',
                        device: 'Computer',
                        os: 'Windows',
                        isActive: false,
                        seenAt: '25 years ago',
                    },
                ] }));
        });
    });
    describe('when userSessionRevoked is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(userReducer, __assign(__assign({}, initialUserState), { sessions: [
                    {
                        id: 1,
                        browser: 'Chrome',
                        browserVersion: '90',
                        osVersion: '95',
                        clientIp: '192.168.1.1',
                        createdAt: '2021-01-01',
                        device: 'Computer',
                        os: 'Windows',
                        isActive: false,
                        seenAt: '1996-01-01',
                    },
                ] }))
                .whenActionIsDispatched(userSessionRevoked({ tokenId: 1 }))
                .thenStateShouldEqual(__assign(__assign({}, initialUserState), { sessions: [] }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map