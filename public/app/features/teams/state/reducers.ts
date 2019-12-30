import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Team, TeamGroup, TeamMember, TeamsState, TeamState } from 'app/types';

export const initialTeamsState: TeamsState = { teams: [], searchQuery: '', hasFetched: false };

const teamsSlice = createSlice({
  name: 'teams',
  initialState: initialTeamsState,
  reducers: {
    teamsLoaded: (state, action: PayloadAction<Team[]>) => {
      return { ...state, hasFetched: true, teams: action.payload };
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      return { ...state, searchQuery: action.payload };
    },
  },
});

export const { teamsLoaded, setSearchQuery } = teamsSlice.actions;

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
    teamLoaded: (state, action: PayloadAction<Team>) => {
      return { ...state, team: action.payload };
    },
    teamMembersLoaded: (state, action: PayloadAction<TeamMember[]>) => {
      return { ...state, members: action.payload };
    },
    setSearchMemberQuery: (state, action: PayloadAction<string>) => {
      return { ...state, searchMemberQuery: action.payload };
    },
    teamGroupsLoaded: (state, action: PayloadAction<TeamGroup[]>) => {
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
