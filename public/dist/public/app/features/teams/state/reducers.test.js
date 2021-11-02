import { __assign } from "tslib";
import { initialTeamsState, initialTeamState, setSearchMemberQuery, setSearchQuery, teamGroupsLoaded, teamLoaded, teamMembersLoaded, teamReducer, teamsLoaded, teamsReducer, } from './reducers';
import { getMockTeam, getMockTeamGroups, getMockTeamMember } from '../__mocks__/teamMocks';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
describe('teams reducer', function () {
    describe('when teamsLoaded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(teamsReducer, __assign({}, initialTeamsState))
                .whenActionIsDispatched(teamsLoaded([getMockTeam()]))
                .thenStateShouldEqual(__assign(__assign({}, initialTeamsState), { hasFetched: true, teams: [getMockTeam()] }));
        });
    });
    describe('when setSearchQueryAction is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(teamsReducer, __assign({}, initialTeamsState))
                .whenActionIsDispatched(setSearchQuery('test'))
                .thenStateShouldEqual(__assign(__assign({}, initialTeamsState), { searchQuery: 'test' }));
        });
    });
});
describe('team reducer', function () {
    describe('when loadTeamsAction is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(teamReducer, __assign({}, initialTeamState))
                .whenActionIsDispatched(teamLoaded(getMockTeam()))
                .thenStateShouldEqual(__assign(__assign({}, initialTeamState), { team: getMockTeam() }));
        });
    });
    describe('when loadTeamMembersAction is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(teamReducer, __assign({}, initialTeamState))
                .whenActionIsDispatched(teamMembersLoaded([getMockTeamMember()]))
                .thenStateShouldEqual(__assign(__assign({}, initialTeamState), { members: [getMockTeamMember()] }));
        });
    });
    describe('when setSearchMemberQueryAction is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(teamReducer, __assign({}, initialTeamState))
                .whenActionIsDispatched(setSearchMemberQuery('member'))
                .thenStateShouldEqual(__assign(__assign({}, initialTeamState), { searchMemberQuery: 'member' }));
        });
    });
    describe('when loadTeamGroupsAction is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(teamReducer, __assign({}, initialTeamState))
                .whenActionIsDispatched(teamGroupsLoaded(getMockTeamGroups(1)))
                .thenStateShouldEqual(__assign(__assign({}, initialTeamState), { groups: getMockTeamGroups(1) }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map