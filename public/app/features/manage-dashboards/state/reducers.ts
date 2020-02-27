import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DashboardDTO } from 'app/types';

export enum DashboardSource {
  Gcom = 0,
  Json = 1,
}

export interface ImportDashboardState {
  meta: { updatedAt: string; orgName: string };
  dashboard: any;
  source: DashboardSource;
  inputs: any[];
  gcomError: string;
  isLoaded: boolean;
  uidExists: boolean;
  uidError: string;
  titleExists: boolean;
  titleErrorMessage: string;
}

const initialImportDashboardState: ImportDashboardState = {
  meta: { updatedAt: '', orgName: '' },
  dashboard: {},
  source: DashboardSource.Json,
  inputs: [],
  gcomError: '',
  isLoaded: false,
  uidExists: false,
  uidError: '',
  titleExists: false,
  titleErrorMessage: '',
};

const importDashboardSlice = createSlice({
  name: 'manageDashboards',
  initialState: initialImportDashboardState,
  reducers: {
    setGcomDashboard: (state, action: PayloadAction<any>): ImportDashboardState => {
      return {
        ...state,
        dashboard: {
          ...action.payload.json,
          id: null,
        },
        meta: { updatedAt: action.payload.updatedAt, orgName: action.payload.orgName },
        source: DashboardSource.Gcom,
        isLoaded: true,
      };
    },
    setJsonDashboard: (state, action: PayloadAction<any>): ImportDashboardState => {
      return {
        ...state,
        dashboard: {
          ...action.payload,
          id: null,
        },
        source: DashboardSource.Json,
        isLoaded: true,
      };
    },
    clearDashboard: (state): ImportDashboardState => {
      return {
        ...state,
        dashboard: {},
        isLoaded: false,
      };
    },
    dashboardUidExists: (
      state,
      action: PayloadAction<{ state: boolean; dashboard?: DashboardDTO }>
    ): ImportDashboardState => {
      const dashboard = action.payload.dashboard;

      return {
        ...state,
        uidExists: action.payload.state,
        uidError: `Dashboard named '${dashboard?.dashboard.title}' in folder '${dashboard?.meta.folderTitle}' has the same uid`,
      };
    },
    dashboardTitleExists: (state, action: PayloadAction<{ state: boolean; error: string }>): ImportDashboardState => {
      return {
        ...state,
        titleExists: action.payload.state,
        titleErrorMessage: action.payload.error,
      };
    },
    setGcomError: (state, action: PayloadAction<string>): ImportDashboardState => ({
      ...state,
      gcomError: action.payload,
    }),
    setInputs: (state, action: PayloadAction<any[]>): ImportDashboardState => ({
      ...state,
      inputs: action.payload,
    }),
  },
});

export const {
  clearDashboard,
  setInputs,
  setGcomDashboard,
  setJsonDashboard,
  setGcomError,
  dashboardUidExists,
  dashboardTitleExists,
} = importDashboardSlice.actions;

export const importDashboardReducer = importDashboardSlice.reducer;

export default {
  importDashboard: importDashboardReducer,
};
