import { Action, ActionTypes } from './actions';
import { inititalState, folderReducer } from './reducers';

describe('folder reducer', () => {
  it('should set teams', () => {
    const payload = [getMockTeam()];

    const action: Action = {
      type: ActionTypes.LoadTeams,
      payload,
    };

    const result = teamsReducer(initialTeamsState, action);

    expect(result.teams).toEqual(payload);
  });
});
