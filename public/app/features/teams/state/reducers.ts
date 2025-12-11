import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { TeamState, TeamGroup } from 'app/types/teams';

export const initialTeamState: TeamState = {
  groups: [],
};

const teamSlice = createSlice({
  name: 'team',
  initialState: initialTeamState,
  reducers: {
    teamGroupsLoaded: (state, action: PayloadAction<TeamGroup[]>): TeamState => {
      return { ...state, groups: action.payload };
    },
  },
});

export const { teamGroupsLoaded } = teamSlice.actions;

export const teamReducer = teamSlice.reducer;

export default {
  team: teamReducer,
};
