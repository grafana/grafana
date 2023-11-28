import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { OrgRole, TeamPermissionLevel } from '../../../types';
import { getMockTeam } from '../../teams/__mocks__/teamMocks';
import { initialUserState, orgsLoaded, sessionsLoaded, setUpdating, teamsLoaded, updateTimeZone, updateWeekStart, userLoaded, userReducer, userSessionRevoked, } from './reducers';
describe('userReducer', () => {
    let dateNow;
    beforeAll(() => {
        dateNow = jest.spyOn(Date, 'now').mockImplementation(() => 1609470000000); // 2021-01-01 04:00:00
    });
    afterAll(() => {
        dateNow.mockRestore();
    });
    describe('when updateTimeZone is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(userReducer, Object.assign({}, initialUserState))
                .whenActionIsDispatched(updateTimeZone({ timeZone: 'xyz' }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialUserState), { timeZone: 'xyz' }));
        });
    });
    describe('when updateWeekStart is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(userReducer, Object.assign({}, initialUserState))
                .whenActionIsDispatched(updateWeekStart({ weekStart: 'xyz' }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialUserState), { weekStart: 'xyz' }));
        });
    });
    describe('when setUpdating is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(userReducer, Object.assign(Object.assign({}, initialUserState), { isUpdating: false }))
                .whenActionIsDispatched(setUpdating({ updating: true }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialUserState), { isUpdating: true }));
        });
    });
    describe('when userLoaded is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(userReducer, Object.assign(Object.assign({}, initialUserState), { user: null }))
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
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialUserState), { user: {
                    id: 2021,
                    email: 'test@test.com',
                    isDisabled: true,
                    login: 'test',
                    name: 'Test Account',
                    isGrafanaAdmin: false,
                } }));
        });
    });
    describe('when teamsLoaded is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(userReducer, Object.assign(Object.assign({}, initialUserState), { teamsAreLoading: true }))
                .whenActionIsDispatched(teamsLoaded({
                teams: [getMockTeam(1, { permission: TeamPermissionLevel.Admin })],
            }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialUserState), { teamsAreLoading: false, teams: [getMockTeam(1, { permission: TeamPermissionLevel.Admin })] }));
        });
    });
    describe('when orgsLoaded is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(userReducer, Object.assign(Object.assign({}, initialUserState), { orgsAreLoading: true }))
                .whenActionIsDispatched(orgsLoaded({
                orgs: [{ orgId: 1, name: 'Main', role: OrgRole.Viewer }],
            }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialUserState), { orgsAreLoading: false, orgs: [{ orgId: 1, name: 'Main', role: OrgRole.Viewer }] }));
        });
    });
    describe('when sessionsLoaded is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(userReducer, Object.assign(Object.assign({}, initialUserState), { sessionsAreLoading: true }))
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
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialUserState), { sessionsAreLoading: false, sessions: [
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
                        seenAt: '25 years ago',
                    },
                ] }));
        });
    });
    describe('when userSessionRevoked is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(userReducer, Object.assign(Object.assign({}, initialUserState), { sessions: [
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
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialUserState), { sessions: [] }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map