import { Team, TeamGroup, TeamMember, TeamsState, TeamState } from 'app/types';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export const initialTeamsState: TeamsState = { teams: [], searchQuery: '', hasFetched: false };
export const initialTeamState: TeamState = {
  team: {} as Team,
  members: [] as TeamMember[],
  groups: [] as TeamGroup[],
  searchMemberQuery: '',
};

interface TeamsStateReducers<S> extends Record<string, any> {
  loadTeamsAction: (state: S, action: PayloadAction<Team[]>) => S;
  setSearchQueryAction: (state: S, action: PayloadAction<string>) => S;
}

export const teamsSlice = createSlice<TeamsState, TeamsStateReducers<TeamsState>>({
  name: 'teams',
  initialState: initialTeamsState,
  reducers: {
    // https://redux-starter-kit.js.org/tutorials/advanced-tutorial/#declaring-types-for-slice-state-and-actions
    // createSlice tries to infer types from two sources:
    // The state type is based on the type of the initialState field
    // Each reducer needs to declare the type of the action it expects to handle
    // We don't have to declare a type for state, because createSlice already knows that this should be the same type as our initialState
    // Didn't work with our TypeScript settings so I had to declare TeamsState in the state prop for each reducer
    // and without declaring TeamsState as return type the typings don't work in the return (same issue with our home grown solution)
    loadTeamsAction(state, action) {
      return { ...state, hasFetched: true, teams: action.payload };
    },
    setSearchQueryAction(state, action) {
      return { ...state, searchQuery: action.payload };
    },
  },
});

interface TeamStateReducers<S> extends Record<string, any> {
  loadTeamAction: (state: S, action: PayloadAction<Team>) => S;
  loadTeamMembersAction: (state: S, action: PayloadAction<TeamMember[]>) => S;
  setSearchMemberQueryAction: (state: S, action: PayloadAction<string>) => S;
  loadTeamGroupsAction: (state: S, action: PayloadAction<TeamGroup[]>) => S;
}

export const teamSlice = createSlice<TeamState, TeamStateReducers<TeamState>>({
  name: 'team',
  initialState: initialTeamState,
  reducers: {
    // https://redux-starter-kit.js.org/tutorials/advanced-tutorial/#declaring-types-for-slice-state-and-actions
    // createSlice tries to infer types from two sources:
    // The state type is based on the type of the initialState field
    // Each reducer needs to declare the type of the action it expects to handle
    // We don't have to declare a type for state, because createSlice already knows that this should be the same type as our initialState
    // Didn't work with our TypeScript settings so I had to declare TeamsState in the state prop for each reducer
    // and without declaring TeamsState as return type the typings don't work in the return (same issue with our home grown solution)
    loadTeamAction(state, action: PayloadAction<Team>): TeamState {
      return { ...state, team: action.payload };
    },
    loadTeamMembersAction(state, action: PayloadAction<TeamMember[]>): TeamState {
      return { ...state, members: action.payload };
    },
    setSearchMemberQueryAction(state, action: PayloadAction<string>): TeamState {
      return { ...state, searchMemberQuery: action.payload };
    },
    loadTeamGroupsAction(state, action: PayloadAction<TeamGroup[]>): TeamState {
      return { ...state, groups: action.payload };
    },
  },
});

export const { loadTeamsAction, setSearchQueryAction } = teamsSlice.actions;
export const {
  loadTeamAction,
  loadTeamGroupsAction,
  loadTeamMembersAction,
  setSearchMemberQueryAction,
} = teamSlice.actions;

export default {
  teams: teamsSlice.reducer,
  team: teamSlice.reducer,
};
