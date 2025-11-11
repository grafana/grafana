import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { TeamsState, Team, TeamState, TeamGroup } from 'app/types/teams';

export const initialTeamsState: TeamsState = {
  teams: [],
  page: 1,
  query: '',
  perPage: 30,
  totalPages: 0,
  noTeams: false,
  hasFetched: false,
};

export const initialTeamState: TeamState = {
  groups: [],
};

const teamSlice = createSlice({
  name: 'team',
  initialState: initialTeamState,
  reducers: {
    teamLoaded: (state, action: PayloadAction<Team>): TeamState => {
      return { ...state, team: action.payload };
    },
    teamGroupsLoaded: (state, action: PayloadAction<TeamGroup[]>): TeamState => {
      return { ...state, groups: action.payload };
    },
  },
});

export const { teamLoaded, teamGroupsLoaded } = teamSlice.actions;

export const teamReducer = teamSlice.reducer;

export default {
  team: teamReducer,
};
