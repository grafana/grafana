import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { DashboardCursorSync, PanelPlugin } from '@grafana/data';
import { AngularComponent } from '@grafana/runtime';
import { processAclItems } from 'app/core/utils/acl';
import { DashboardAclDTO, DashboardInitError, DashboardInitPhase, DashboardProps, DashboardState } from 'app/types';

import { DashboardModel } from './DashboardModel';
import { PanelModel } from './PanelModel';

export const initialState: DashboardState = {
  initPhase: DashboardInitPhase.NotStarted,
  getModel: () => null,
  permissions: [],
  initError: null,
  title: '',
  liveNow: false,
  graphTooltip: DashboardCursorSync.Off,
  description: '',
  style: 'dark',
  tags: [],
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    loadDashboardPermissions: (state, action: PayloadAction<DashboardAclDTO[]>) => {
      state.permissions = processAclItems(action.payload);
    },
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
        return new DashboardModel({ title: 'Dashboard init failed' }, { canSave: false, canEdit: false });
      };
    },
    cleanUpDashboard: (state) => {
      state.initPhase = DashboardInitPhase.NotStarted;
      state.initError = null;
      state.getModel = () => null;
    },
    updateDashboard: (state, action: PayloadAction<Partial<DashboardProps>>) => {
      Object.assign(state, action.payload);
    },
    addPanel: (state, action: PayloadAction<PanelModel>) => {
      //state.panels[action.payload.id] = { pluginId: action.payload.type };
    },
  },
});

export interface PanelModelAndPluginReadyPayload {
  panelId: number;
  plugin: PanelPlugin;
}

export interface SetPanelAngularComponentPayload {
  panelId: number;
  angularComponent: AngularComponent | null;
}

export interface SetPanelInstanceStatePayload {
  panelId: number;
  value: any;
}

export const {
  loadDashboardPermissions,
  dashboardInitFetching,
  dashboardInitFailed,
  dashboardInitCompleted,
  dashboardInitServices,
  cleanUpDashboard,
  addPanel,
  updateDashboard,
} = dashboardSlice.actions;

export const dashboardReducer = dashboardSlice.reducer;

export default {
  dashboard: dashboardReducer,
};
