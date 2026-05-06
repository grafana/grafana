import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { type PanelPlugin } from '@grafana/data';
import { DashboardInitPhase, type DashboardState } from 'app/types/dashboard';

export const initialState: DashboardState = {
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

export interface PanelModelAndPluginReadyPayload {
  panelId: number;
  plugin: PanelPlugin;
}

export interface SetPanelInstanceStatePayload {
  panelId: number;
  value: unknown;
}

export const { setInitialDatasource } = dashboardSlice.actions;

export const dashboardReducer = dashboardSlice.reducer;

export default {
  dashboard: dashboardReducer,
};
