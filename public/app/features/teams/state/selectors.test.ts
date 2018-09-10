import { getTeam, getTeams } from './selectors';
import { getMockTeam, getMultipleMockTeams } from '../__mocks__/teamMocks';
import { TeamsState, TeamState } from '../../../types';

describe('Teams selectors', () => {
  describe('Get teams', () => {
    const mockTeams = getMultipleMockTeams(5);

    it('should return teams if no search query', () => {
      const mockState: TeamsState = { teams: mockTeams, searchQuery: '' };

      const teams = getTeams(mockState);

      expect(teams).toEqual(mockTeams);
    });

    it('Should filter teams if search query', () => {
      const mockState: TeamsState = { teams: mockTeams, searchQuery: '5' };

      const teams = getTeams(mockState);

      expect(teams.length).toEqual(1);
    });
  });
});

describe('Team selectors', () => {
  describe('Get team', () => {
    const mockTeam = getMockTeam();

    it('should return team if matching with location team', () => {
      const mockState: TeamState = { team: mockTeam, searchMemberQuery: '' };

      const team = getTeam(mockState, '1');

      expect(team).toEqual(mockTeam);
    });
  });
});
