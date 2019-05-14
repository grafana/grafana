import { ActionTypes } from './actions';
import { initialTeamsState, initialTeamState, teamReducer, teamsReducer } from './reducers';
import { getMockTeam, getMockTeamMember } from '../__mocks__/teamMocks';
describe('teams reducer', function () {
    it('should set teams', function () {
        var payload = [getMockTeam()];
        var action = {
            type: ActionTypes.LoadTeams,
            payload: payload,
        };
        var result = teamsReducer(initialTeamsState, action);
        expect(result.teams).toEqual(payload);
    });
    it('should set search query', function () {
        var payload = 'test';
        var action = {
            type: ActionTypes.SetSearchQuery,
            payload: payload,
        };
        var result = teamsReducer(initialTeamsState, action);
        expect(result.searchQuery).toEqual('test');
    });
});
describe('team reducer', function () {
    it('should set team', function () {
        var payload = getMockTeam();
        var action = {
            type: ActionTypes.LoadTeam,
            payload: payload,
        };
        var result = teamReducer(initialTeamState, action);
        expect(result.team).toEqual(payload);
    });
    it('should set team members', function () {
        var mockTeamMember = getMockTeamMember();
        var action = {
            type: ActionTypes.LoadTeamMembers,
            payload: [mockTeamMember],
        };
        var result = teamReducer(initialTeamState, action);
        expect(result.members).toEqual([mockTeamMember]);
    });
    it('should set member search query', function () {
        var payload = 'member';
        var action = {
            type: ActionTypes.SetSearchMemberQuery,
            payload: payload,
        };
        var result = teamReducer(initialTeamState, action);
        expect(result.searchMemberQuery).toEqual('member');
    });
});
//# sourceMappingURL=reducers.test.js.map