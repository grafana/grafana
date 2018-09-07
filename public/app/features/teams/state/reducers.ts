import { Team, TeamsState, TeamState } from '../../../types';
import { Action, ActionTypes } from './actions';

export const initialTeamsState: TeamsState = { teams: [], searchQuery: '' };
export const initialTeamState: TeamState = { team: {} as Team, searchMemberQuery: '' };

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

    case ActionTypes.LoadTeamMembers:
      return { ...state, team: { ...state.team, members: action.payload } };

    case ActionTypes.SetSearchMemberQuery:
      return { ...state, searchMemberQuery: action.payload };
  }

  return state;
};

export default {
  teams: teamsReducer,
  team: teamReducer,
};
