import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  DashboardInitPhase,
  DashboardState,
  DashboardAclDTO,
  MutableDashboard,
  DashboardInitError,
  QueriesToUpdateOnDashboardLoad,
} from 'app/types';
import { processAclItems } from 'app/core/utils/acl';
import { panelEditorReducer } from '../panel_editor/state/reducers';
import { DashboardModel } from './DashboardModel';

export const initialState: DashboardState = {
  initPhase: DashboardInitPhase.NotStarted,
  isInitSlow: false,
  getModel: () => null,
  permissions: [],
  modifiedQueries: null,
};

const dashbardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    loadDashboardPermissions: (state, action: PayloadAction<DashboardAclDTO[]>) => {
      state.permissions = processAclItems(action.payload);
    },
    dashboardInitFetching: state => {
      state.initPhase = DashboardInitPhase.Fetching;
    },
    dashboardInitServices: state => {
      state.initPhase = DashboardInitPhase.Services;
    },
    dashboardInitSlow: state => {
      state.isInitSlow = true;
    },
    dashboardInitCompleted: (state, action: PayloadAction<MutableDashboard>) => {
      state.getModel = () => action.payload;
      state.initPhase = DashboardInitPhase.Completed;
      state.isInitSlow = false;
    },
    dashboardInitFailed: (state, action: PayloadAction<DashboardInitError>) => {
      const failedDashboard = new DashboardModel(
        { title: 'Dashboard init failed' },
        { canSave: false, canEdit: false }
      );

      state.initPhase = DashboardInitPhase.Failed;
      state.initError = action.payload;
      state.getModel = () => failedDashboard;
    },
    cleanUpDashboard: state => {
      if (state.getModel()) {
        state.getModel().destroy();
        state.getModel = () => null;
      }

      state.initPhase = DashboardInitPhase.NotStarted;
      state.isInitSlow = false;
      state.initError = null;
    },
    setDashboardQueriesToUpdateOnLoad: (state, action: PayloadAction<QueriesToUpdateOnDashboardLoad>) => {
      state.modifiedQueries = action.payload;
    },
    clearDashboardQueriesToUpdateOnLoad: state => {
      state.modifiedQueries = null;
    },
  },
});

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
} = dashbardSlice.actions;

export const dashboardReducer = dashbardSlice.reducer;

export default {
  dashboard: dashboardReducer,
  panelEditor: panelEditorReducer,
};
