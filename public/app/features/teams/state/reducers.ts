import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Team, TeamGroup, TeamMember, TeamsState, TeamState } from 'app/types';

export const initialTeamsState: TeamsState = {
  teams: [],
  page: 1,
  query: '',
  perPage: 30,
  totalPages: 0,
  noTeams: false,
  hasFetched: false,
};

type TeamsFetched = {
  teams: Team[];
  page: number;
  perPage: number;
  noTeams: boolean;
  totalCount: number;
};

const teamsSlice = createSlice({
  name: 'teams',
  initialState: initialTeamsState,
  reducers: {
    teamsLoaded: (state, action: PayloadAction<TeamsFetched>): TeamsState => {
      const { totalCount, perPage, ...rest } = action.payload;
      const totalPages = Math.ceil(totalCount / perPage);
      return { ...state, ...rest, totalPages, perPage, hasFetched: true };
    },
    queryChanged: (state, action: PayloadAction<string>): TeamsState => {
      return { ...state, page: 1, query: action.payload };
    },
    pageChanged: (state, action: PayloadAction<number>): TeamsState => {
      return { ...state, page: action.payload };
    },
  },
});

export const { teamsLoaded, queryChanged, pageChanged } = teamsSlice.actions;

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
