import { TeamsState } from '../../../types';
import { Action, ActionTypes } from './actions';

const initialState: TeamsState = { teams: [] };

export const teamsReducer = (state = initialState, action: Action): TeamsState => {
  switch (action.type) {
    case ActionTypes.LoadTeams:
      return { teams: action.payload };
  }
  return state;
};

export default {
  teams: teamsReducer,
};
