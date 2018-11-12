import { Team, TeamGroup, TeamMember, TeamsState, TeamState, OrganizationPreferences } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialTeamsState: TeamsState = { teams: [], searchQuery: '', hasFetched: false };
export const initialTeamState: TeamState = {
  team: {} as Team,
  members: [] as TeamMember[],
  groups: [] as TeamGroup[],
  searchMemberQuery: '',
  preferences: {} as OrganizationPreferences,
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

    case ActionTypes.LoadTeamPreferences:
      return { ...state, preferences: action.payload };

    case ActionTypes.SetTeamTheme:
      return { ...state, preferences: { ...state.preferences, theme: action.payload } };

    case ActionTypes.SetTeamHomeDashboard:
      return { ...state, preferences: { ...state.preferences, homeDashboardId: action.payload } };

    case ActionTypes.SetTeamTimezone:
      return { ...state, preferences: { ...state.preferences, timezone: action.payload } };
  }

  return state;
};

export default {
  teams: teamsReducer,
  team: teamReducer,
};
