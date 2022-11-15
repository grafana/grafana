import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Team, TeamGroup, TeamMember, TeamsState, TeamState } from 'app/types';

export const initialTeamsState: TeamsState = {
  teams: [],
  currentPage: 1,
  searchQuery: '',
  totalCount: 0,
  hasFetched: false,
};

const teamsSlice = createSlice({
  name: 'teams',
  initialState: initialTeamsState,
  reducers: {
    teamsLoaded: (state, action: PayloadAction<{ teams: Team[]; totalCount: number }>): TeamsState => {
      return { ...state, hasFetched: true, teams: action.payload.teams, totalCount: action.payload.totalCount };
    },
    setSearchQuery: (state, action: PayloadAction<string>): TeamsState => {
      return { ...state, searchQuery: action.payload, currentPage: initialTeamsState.currentPage };
    },
    setCurrentPage: (state, action: PayloadAction<number>): TeamsState => {
      return { ...state, currentPage: action.payload };
    },
  },
});

export const { teamsLoaded, setSearchQuery, setCurrentPage } = teamsSlice.actions;

export const teamsReducer = teamsSlice.reducer;

export const initialTeamState: TeamState = {
  team: {} as Team,
  members: [] as TeamMember[],
  groups: [] as TeamGroup[],
  searchMemberQuery: '',
};

const teamSlice = createSlice({
  name: 'team',
  initialState: initialTeamState,
  reducers: {
    teamLoaded: (state, action: PayloadAction<Team>): TeamState => {
      return { ...state, team: action.payload };
    },
    teamMembersLoaded: (state, action: PayloadAction<TeamMember[]>): TeamState => {
      return { ...state, members: action.payload };
    },
    setSearchMemberQuery: (state, action: PayloadAction<string>): TeamState => {
      return { ...state, searchMemberQuery: action.payload };
    },
    teamGroupsLoaded: (state, action: PayloadAction<TeamGroup[]>): TeamState => {
      return { ...state, groups: action.payload };
    },
  },
});

export const { teamLoaded, teamGroupsLoaded, teamMembersLoaded, setSearchMemberQuery } = teamSlice.actions;

export const teamReducer = teamSlice.reducer;

export default {
  teams: teamsReducer,
  team: teamReducer,
};
