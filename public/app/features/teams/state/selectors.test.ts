import { TeamState } from 'app/types/teams';

import { getMockTeam } from '../mocks/teamMocks';

import { getTeam } from './selectors';

describe('Team selectors', () => {
  describe('Get team', () => {
    const mockTeam = getMockTeam();

    it('should return team if matching with location team', () => {
      const mockState: TeamState = {
        team: mockTeam,
        searchMemberQuery: '',
        members: [],
        groups: [],
      };

      const team = getTeam(mockState, 'aaaaaa');
      expect(team).toEqual(mockTeam);
    });
  });
});
