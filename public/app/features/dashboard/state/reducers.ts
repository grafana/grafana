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
    loadDashboardPermissions: (state, action: PayloadAction<DashboardAclDTO[]>): DashboardState => {
      return {
        ...state,
        permissions: processAclItems(action.payload),
      };
    },
    dashboardInitFetching: (state, action: PayloadAction): DashboardState => {
      return {
        ...state,
        initPhase: DashboardInitPhase.Fetching,
      };
    },
    dashboardInitServices: (state, action: PayloadAction): DashboardState => {
      return {
        ...state,
        initPhase: DashboardInitPhase.Services,
      };
    },
    dashboardInitSlow: (state, action: PayloadAction): DashboardState => {
      return {
        ...state,
        isInitSlow: true,
      };
    },
    dashboardInitCompleted: (state, action: PayloadAction<MutableDashboard>): DashboardState => {
      return {
        ...state,
        getModel: () => action.payload,
        initPhase: DashboardInitPhase.Completed,
        isInitSlow: false,
      };
    },
    dashboardInitFailed: (state, action: PayloadAction<DashboardInitError>): DashboardState => {
      const model = new DashboardModel({ title: 'Dashboard init failed' }, { canSave: false, canEdit: false });

      return {
        ...state,
        initPhase: DashboardInitPhase.Failed,
        isInitSlow: false,
        initError: action.payload,
        getModel: () => model,
      };
    },
    cleanUpDashboard: (state, action: PayloadAction): DashboardState => {
      if (state.getModel) {
        state.getModel().destroy();
      }

      return {
        ...state,
        initPhase: DashboardInitPhase.NotStarted,
        getModel: () => null,
        isInitSlow: false,
        initError: null,
      };
    },
    setDashboardQueriesToUpdateOnLoad: (
      state,
      action: PayloadAction<QueriesToUpdateOnDashboardLoad>
    ): DashboardState => {
      return {
        ...state,
        modifiedQueries: action.payload,
      };
    },
    clearDashboardQueriesToUpdateOnLoad: (state, action: PayloadAction): DashboardState => {
      return {
        ...state,
        modifiedQueries: null,
      };
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
