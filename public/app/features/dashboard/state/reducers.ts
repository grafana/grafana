import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  DashboardAclDTO,
  DashboardAttributes,
  DashboardInitError,
  DashboardInitPhase,
  DashboardState,
  QueriesToUpdateOnDashboardLoad,
} from 'app/types';
import { AngularComponent } from '@grafana/runtime';
import { processAclItems } from 'app/core/utils/acl';
import { DashboardModel } from './DashboardModel';
import { PanelModel } from './PanelModel';
import { PanelPlugin } from '@grafana/data';

export const initialState: DashboardState = {
  initPhase: DashboardInitPhase.NotStarted,
  isInitSlow: false,
  getModel: () => null,
  permissions: [],
  modifiedQueries: null,
  initError: null,
  attributes: {
    title: '',
    description: '',
  },
};

const dashbardSlice = createSlice({
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
    dashboardInitSlow: (state) => {
      state.isInitSlow = true;
    },
    dashboardInitCompleted: (state, action: PayloadAction<DashboardModel>) => {
      state.getModel = () => action.payload;
      state.initPhase = DashboardInitPhase.Completed;
      state.isInitSlow = false;
      // just for testing  what this could look like
      state.attributes.title = action.payload.title;
      state.attributes.description = action.payload.description;
    },
    setDashboardAttributes: (state, action: PayloadAction<Partial<DashboardAttributes>>) => {
      Object.assign(state.attributes, action.payload);
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
      state.isInitSlow = false;
      state.initError = null;
      state.getModel = () => null;
    },
    setDashboardQueriesToUpdateOnLoad: (state, action: PayloadAction<QueriesToUpdateOnDashboardLoad>) => {
      state.modifiedQueries = action.payload;
    },
    clearDashboardQueriesToUpdateOnLoad: (state) => {
      state.modifiedQueries = null;
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
  dashboardInitSlow,
  dashboardInitCompleted,
  dashboardInitServices,
  cleanUpDashboard,
  setDashboardAttributes,
  setDashboardQueriesToUpdateOnLoad,
  clearDashboardQueriesToUpdateOnLoad,
  addPanel,
} = dashbardSlice.actions;

export const dashboardReducer = dashbardSlice.reducer;

export default {
  dashboard: dashboardReducer,
};
