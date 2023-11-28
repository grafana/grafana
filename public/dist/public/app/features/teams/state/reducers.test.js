import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getMockTeam, getMockTeamGroups, getMockTeamMember } from '../__mocks__/teamMocks';
import { initialTeamsState, initialTeamState, setSearchMemberQuery, teamGroupsLoaded, teamLoaded, queryChanged, teamMembersLoaded, teamReducer, teamsLoaded, teamsReducer, } from './reducers';
describe('teams reducer', () => {
    describe('when teamsLoaded is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(teamsReducer, Object.assign({}, initialTeamsState))
                .whenActionIsDispatched(teamsLoaded({ teams: [getMockTeam()], page: 1, perPage: 30, noTeams: false, totalCount: 100 }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialTeamsState), { hasFetched: true, teams: [getMockTeam()], noTeams: false, totalPages: 4, perPage: 30, page: 1 }));
        });
    });
    describe('when setSearchQueryAction is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(teamsReducer, Object.assign({}, initialTeamsState))
                .whenActionIsDispatched(queryChanged('test'))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialTeamsState), { query: 'test' }));
        });
    });
});
describe('team reducer', () => {
    describe('when loadTeamsAction is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(teamReducer, Object.assign({}, initialTeamState))
                .whenActionIsDispatched(teamLoaded(getMockTeam()))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialTeamState), { team: getMockTeam() }));
        });
    });
    describe('when loadTeamMembersAction is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(teamReducer, Object.assign({}, initialTeamState))
                .whenActionIsDispatched(teamMembersLoaded([getMockTeamMember()]))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialTeamState), { members: [getMockTeamMember()] }));
        });
    });
    describe('when setSearchMemberQueryAction is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(teamReducer, Object.assign({}, initialTeamState))
                .whenActionIsDispatched(setSearchMemberQuery('member'))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialTeamState), { searchMemberQuery: 'member' }));
        });
    });
    describe('when loadTeamGroupsAction is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(teamReducer, Object.assign({}, initialTeamState))
                .whenActionIsDispatched(teamGroupsLoaded(getMockTeamGroups(1)))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialTeamState), { groups: getMockTeamGroups(1) }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map