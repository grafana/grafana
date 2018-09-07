import { Action, ActionTypes } from './actions';
import { initialTeamsState, initialTeamState, teamReducer, teamsReducer } from './reducers';
import { getMockTeam, getMockTeamMember } from '../__mocks__/teamMocks';

describe('teams reducer', () => {
  it('should set teams', () => {
    const payload = [getMockTeam()];

    const action: Action = {
      type: ActionTypes.LoadTeams,
      payload,
    };

    const result = teamsReducer(initialTeamsState, action);

    expect(result.teams).toEqual(payload);
  });

  it('should set search query', () => {
    const payload = 'test';

    const action: Action = {
      type: ActionTypes.SetSearchQuery,
      payload,
    };

    const result = teamsReducer(initialTeamsState, action);

    expect(result.searchQuery).toEqual('test');
  });
});

describe('team reducer', () => {
  it('should set team members', () => {
    const mockTeamMember = getMockTeamMember();
    const mockTeam = getMockTeam();
    const state = {
      ...initialTeamState,
      team: mockTeam,
    };

    const action: Action = {
      type: ActionTypes.LoadTeamMembers,
      payload: [mockTeamMember],
    };

    const result = teamReducer(state, action);
    const expectedState = { team: { ...mockTeam, members: [mockTeamMember] }, searchQuery: '' };

    expect(result).toEqual(expectedState);
  });
});
