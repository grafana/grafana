import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { DashboardSettingsState, DashboardVariablesSettings } from './types';

export const initialDashboardSettingsState: DashboardSettingsState = {
  variables: {
    showUnknowns: true,
  },
};

const dashboardSettingsSlice = createSlice({
  name: 'dashboard/settings',
  initialState: initialDashboardSettingsState,
  reducers: {
    setVariableSettings: (state, action: PayloadAction<DashboardVariablesSettings>) => {
      state.variables = action.payload;
    },
  },
});

export const { setVariableSettings } = dashboardSettingsSlice.actions;

export const dashboardSettingsReducer = dashboardSettingsSlice.reducer;
