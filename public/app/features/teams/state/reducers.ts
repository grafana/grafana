import { TeamsState } from '../../../types';
import { Action, ActionTypes } from './actions';

export const initialState: TeamsState = { teams: [], searchQuery: '' };

export const teamsReducer = (state = initialState, action: Action): TeamsState => {
  switch (action.type) {
    case ActionTypes.LoadTeams:
      return { ...state, teams: action.payload };

    case ActionTypes.SetSearchQuery:
      return { ...state, searchQuery: action.payload };
  }
  return state;
};

export default {
  teams: teamsReducer,
};
