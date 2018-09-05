import { getTeams } from './selectors';
import { getMultipleMockTeams } from '../__mocks__/teamMocks';
import { TeamsState } from '../../../types';

describe('Team selectors', () => {
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
