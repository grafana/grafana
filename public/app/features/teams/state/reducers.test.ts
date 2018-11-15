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
  it('should set team', () => {
    const payload = getMockTeam();

    const action: Action = {
      type: ActionTypes.LoadTeam,
      payload,
    };

    const result = teamReducer(initialTeamState, action);

    expect(result.team).toEqual(payload);
  });

  it('should set team members', () => {
    const mockTeamMember = getMockTeamMember();

    const action: Action = {
      type: ActionTypes.LoadTeamMembers,
      payload: [mockTeamMember],
    };

    const result = teamReducer(initialTeamState, action);

    expect(result.members).toEqual([mockTeamMember]);
  });

  it('should set member search query', () => {
    const payload = 'member';

    const action: Action = {
      type: ActionTypes.SetSearchMemberQuery,
      payload,
    };

    const result = teamReducer(initialTeamState, action);

    expect(result.searchMemberQuery).toEqual('member');
  });
});
