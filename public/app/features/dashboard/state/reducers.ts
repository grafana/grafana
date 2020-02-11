import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  DashboardInitPhase,
  DashboardState,
  DashboardAclDTO,
  DashboardInitError,
  QueriesToUpdateOnDashboardLoad,
} from 'app/types';
import { processAclItems } from 'app/core/utils/acl';
import { panelEditorReducer } from '../panel_editor/state/reducers';
import { panelEditorReducerNew } from '../components/PanelEditor/state/reducers';
import { DashboardModel } from './DashboardModel';
import { PanelModel } from './PanelModel';

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
    dashboardInitFetching: (state, action: PayloadAction) => {
      state.initPhase = DashboardInitPhase.Fetching;
    },
    dashboardInitServices: (state, action: PayloadAction) => {
      state.initPhase = DashboardInitPhase.Services;
    },
    dashboardInitSlow: (state, action: PayloadAction) => {
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
    cleanUpDashboard: (state, action: PayloadAction) => {
      if (state.getModel()) {
        state.getModel()!.destroy();
        state.getModel = () => null;
      }

      state.initPhase = DashboardInitPhase.NotStarted;
      state.isInitSlow = false;
      state.initError = null;
    },
    setDashboardQueriesToUpdateOnLoad: (state, action: PayloadAction<QueriesToUpdateOnDashboardLoad>) => {
      state.modifiedQueries = action.payload;
    },
    clearDashboardQueriesToUpdateOnLoad: (state, action: PayloadAction) => {
      state.modifiedQueries = null;
    },
    dashboardPanelTypeChanged: (state, action: PayloadAction<DashboardPanelTypeChangedPayload>) => {
      state.panels[action.payload.panelId] = { pluginId: action.payload.pluginId };
    },
    addPanelToDashboard: (state, action: PayloadAction<AddPanelPayload>) => {},
  },
});

export interface DashboardPanelTypeChangedPayload {
  panelId: number;
  pluginId: string;
}

export interface AddPanelPayload {
  panel: PanelModel;
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
  dashboardPanelTypeChanged,
  addPanelToDashboard,
} = dashbardSlice.actions;

export const dashboardReducer = dashbardSlice.reducer;

export default {
  dashboard: dashboardReducer,
  panelEditor: panelEditorReducer,
  panelEditorNew: panelEditorReducerNew,
};
