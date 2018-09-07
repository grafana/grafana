import { Action, ActionTypes } from './actions';
import { initialTeamsState, teamsReducer } from './reducers';

describe('teams reducer', () => {
  it('should set teams', () => {
    const payload = [
      {
        id: 1,
        name: 'test',
        avatarUrl: 'some/url/',
        email: 'test@test.com',
        memberCount: 1,
        search: '',
        members: [],
        groups: [],
      },
    ];

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
