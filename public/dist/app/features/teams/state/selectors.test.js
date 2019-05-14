import { getTeam, getTeamMembers, getTeams } from './selectors';
import { getMockTeam, getMockTeamMembers, getMultipleMockTeams } from '../__mocks__/teamMocks';
describe('Teams selectors', function () {
    describe('Get teams', function () {
        var mockTeams = getMultipleMockTeams(5);
        it('should return teams if no search query', function () {
            var mockState = { teams: mockTeams, searchQuery: '', hasFetched: false };
            var teams = getTeams(mockState);
            expect(teams).toEqual(mockTeams);
        });
        it('Should filter teams if search query', function () {
            var mockState = { teams: mockTeams, searchQuery: '5', hasFetched: false };
            var teams = getTeams(mockState);
            expect(teams.length).toEqual(1);
        });
    });
});
describe('Team selectors', function () {
    describe('Get team', function () {
        var mockTeam = getMockTeam();
        it('should return team if matching with location team', function () {
            var mockState = {
                team: mockTeam,
                searchMemberQuery: '',
                members: [],
                groups: [],
            };
            var team = getTeam(mockState, '1');
            expect(team).toEqual(mockTeam);
        });
    });
    describe('Get members', function () {
        var mockTeamMembers = getMockTeamMembers(5);
        it('should return team members', function () {
            var mockState = {
                team: {},
                searchMemberQuery: '',
                members: mockTeamMembers,
                groups: [],
            };
            var members = getTeamMembers(mockState);
            expect(members).toEqual(mockTeamMembers);
        });
    });
});
//# sourceMappingURL=selectors.test.js.map