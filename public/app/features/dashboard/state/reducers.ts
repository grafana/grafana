import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { DashboardInitPhase, type DashboardState } from 'app/types/dashboard';

const initialState: DashboardState = {
  initPhase: DashboardInitPhase.NotStarted,
  getModel: () => null,
  initError: null,
  initialDatasource: undefined,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setInitialDatasource: (state, action: PayloadAction<string | undefined>) => {
      state.initialDatasource = action.payload;
    },
  },
});

export const { setInitialDatasource } = dashboardSlice.actions;

const dashboardReducer = dashboardSlice.reducer;

export default {
  dashboard: dashboardReducer,
};
