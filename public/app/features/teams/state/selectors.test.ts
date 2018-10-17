import { getTeam, getTeamMembers, getTeams } from './selectors';
import { getMockTeam, getMockTeamMembers, getMultipleMockTeams } from '../__mocks__/teamMocks';
import { Team, TeamGroup, TeamsState, TeamState } from '../../../types';

describe('Teams selectors', () => {
  describe('Get teams', () => {
    const mockTeams = getMultipleMockTeams(5);

    it('should return teams if no search query', () => {
      const mockState: TeamsState = { teams: mockTeams, searchQuery: '', hasFetched: false };

      const teams = getTeams(mockState);

      expect(teams).toEqual(mockTeams);
    });

    it('Should filter teams if search query', () => {
      const mockState: TeamsState = { teams: mockTeams, searchQuery: '5', hasFetched: false };

      const teams = getTeams(mockState);

      expect(teams.length).toEqual(1);
    });
  });
});

describe('Team selectors', () => {
  describe('Get team', () => {
    const mockTeam = getMockTeam();

    it('should return team if matching with location team', () => {
      const mockState: TeamState = { team: mockTeam, searchMemberQuery: '', members: [], groups: [] };

      const team = getTeam(mockState, '1');

      expect(team).toEqual(mockTeam);
    });
  });

  describe('Get members', () => {
    const mockTeamMembers = getMockTeamMembers(5);

    it('should return team members', () => {
      const mockState: TeamState = {
        team: {} as Team,
        searchMemberQuery: '',
        members: mockTeamMembers,
        groups: [] as TeamGroup[],
      };

      const members = getTeamMembers(mockState);

      expect(members).toEqual(mockTeamMembers);
    });
  });
});
