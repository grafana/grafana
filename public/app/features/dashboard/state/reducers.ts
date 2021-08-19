import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';
import {
  DashboardAclDTO,
  DashboardInitError,
  DashboardInitPhase,
  DashboardState,
  PanelState,
  QueriesToUpdateOnDashboardLoad,
} from 'app/types';
import { AngularComponent } from '@grafana/runtime';
import { EDIT_PANEL_ID } from 'app/core/constants';
import { processAclItems } from 'app/core/utils/acl';
import { panelEditorReducer } from '../components/PanelEditor/state/reducers';
import { DashboardModel } from './DashboardModel';
import { PanelModel } from './PanelModel';
import { PanelPlugin } from '@grafana/data';

export const initialState: DashboardState = {
  initPhase: DashboardInitPhase.NotStarted,
  isInitSlow: false,
  getModel: () => null,
  permissions: [],
  modifiedQueries: null,
  panels: {},
  initError: null,
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

      for (const panel of action.payload.panels) {
        state.panels[panel.id] = {
          pluginId: panel.type,
        };
      }
    },
    dashboardInitFailed: (state, action: PayloadAction<DashboardInitError>) => {
      state.initPhase = DashboardInitPhase.Failed;
      state.initError = action.payload;
      state.getModel = () => {
        return new DashboardModel({ title: 'Dashboard init failed' }, { canSave: false, canEdit: false });
      };
    },
    cleanUpDashboard: (state) => {
      state.panels = {};
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
    panelModelAndPluginReady: (state, action: PayloadAction<PanelModelAndPluginReadyPayload>) => {
      updatePanelState(state, action.payload.panelId, { plugin: action.payload.plugin });
    },
    cleanUpEditPanel: (state) => {
      // TODO: refactor, since the state should be mutated by copying only
      delete state.panels[EDIT_PANEL_ID];
    },
    setPanelAngularComponent: (state, action: PayloadAction<SetPanelAngularComponentPayload>) => {
      updatePanelState(state, action.payload.panelId, { angularComponent: action.payload.angularComponent });
    },
    addPanel: (state, action: PayloadAction<PanelModel>) => {
      // TODO: refactor, since the state should be mutated by copying only
      state.panels[action.payload.id] = { pluginId: action.payload.type };
    },
  },
});

export function updatePanelState(state: Draft<DashboardState>, panelId: number, ps: Partial<PanelState>) {
  if (!state.panels[panelId]) {
    state.panels[panelId] = ps as PanelState;
  } else {
    Object.assign(state.panels[panelId], ps);
  }
}

export interface PanelModelAndPluginReadyPayload {
  panelId: number;
  plugin: PanelPlugin;
}

export interface SetPanelAngularComponentPayload {
  panelId: number;
  angularComponent: AngularComponent | null;
}

export const {
  loadDashboardPermissions,
  dashboardInitFetching,
  dashboardInitFailed,
  dashboardInitSlow,
  dashboardInitCompleted,
  dashboardInitServices,
  cleanUpDashboard,
  setDashboardQueriesToUpdateOnLoad,
  clearDashboardQueriesToUpdateOnLoad,
  panelModelAndPluginReady,
  addPanel,
  cleanUpEditPanel,
  setPanelAngularComponent,
} = dashbardSlice.actions;

export const dashboardReducer = dashbardSlice.reducer;

export default {
  dashboard: dashboardReducer,
  panelEditor: panelEditorReducer,
};
