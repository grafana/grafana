import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { PanelPlugin } from '@grafana/data/panel';
import { t } from '@grafana/i18n';
import { defaultDashboard } from '@grafana/schema';
import { type DashboardInitError, DashboardInitPhase, type DashboardState } from 'app/types/dashboard';

import { DashboardModel } from './DashboardModel';
import { type PanelModel } from './PanelModel';

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
    dashboardInitFetching: (state) => {
      state.initPhase = DashboardInitPhase.Fetching;
    },
    dashboardInitServices: (state) => {
      state.initPhase = DashboardInitPhase.Services;
    },
    dashboardInitCompleted: (state, action: PayloadAction<DashboardModel>) => {
      state.getModel = () => action.payload;
      state.initPhase = DashboardInitPhase.Completed;
    },
    dashboardInitFailed: (state, action: PayloadAction<DashboardInitError>) => {
      state.initPhase = DashboardInitPhase.Failed;
      state.initError = action.payload;
      state.getModel = () => {
        return new DashboardModel(
          {
            ...defaultDashboard,
            title: t('dashboard.dashboard-slice.title.dashboard-init-failed', 'Dashboard init failed'),
          },
          { canSave: false, canEdit: false }
        );
      };
    },
    cleanUpDashboard: (state) => {
      state.initPhase = DashboardInitPhase.NotStarted;
      state.initError = null;
      state.getModel = () => null;
    },
    addPanel: (state, action: PayloadAction<PanelModel>) => {
      //state.panels[action.payload.id] = { pluginId: action.payload.type };
    },
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

export const {
  dashboardInitFetching,
  dashboardInitFailed,
  dashboardInitCompleted,
  dashboardInitServices,
  cleanUpDashboard,
  addPanel,
  setInitialDatasource,
} = dashboardSlice.actions;

export const dashboardReducer = dashboardSlice.reducer;

export default {
  dashboard: dashboardReducer,
};
