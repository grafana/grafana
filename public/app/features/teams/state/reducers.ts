import { Team, TeamsState, TeamState } from '../../../types';
import { Action, ActionTypes } from './actions';

export const initialTeamsState: TeamsState = { teams: [], searchQuery: '' };
export const initialTeamState: TeamState = { team: {} as Team, searchQuery: '' };

export const teamsReducer = (state = initialTeamsState, action: Action): TeamsState => {
  switch (action.type) {
    case ActionTypes.LoadTeams:
      return { ...state, teams: action.payload };

    case ActionTypes.SetSearchQuery:
      return { ...state, searchQuery: action.payload };
  }
  return state;
};

export const teamReducer = (state = initialTeamState, action: Action): TeamState => {
  switch (action.type) {
    case ActionTypes.LoadTeam:
      return { ...state, team: action.payload };
  }

  return state;
};

export default {
  teams: teamsReducer,
  team: teamReducer,
};
