import { Team, TeamGroup, TeamMember, TeamsState, TeamState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialTeamsState: TeamsState = { teams: [], searchQuery: '', hasFetched: false };
export const initialTeamState: TeamState = {
  team: {} as Team,
  members: [] as TeamMember[],
  groups: [] as TeamGroup[],
  searchMemberQuery: '',
};

export const teamsReducer = (state = initialTeamsState, action: Action): TeamsState => {
  switch (action.type) {
    case ActionTypes.LoadTeams:
      return { ...state, hasFetched: true, teams: action.payload };

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
      return { ...state, members: action.payload };

    case ActionTypes.SetSearchMemberQuery:
      return { ...state, searchMemberQuery: action.payload };

    case ActionTypes.LoadTeamGroups:
      return { ...state, groups: action.payload };
  }

  return state;
};

export default {
  teams: teamsReducer,
  team: teamReducer,
};
