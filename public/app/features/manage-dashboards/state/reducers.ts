import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DashboardSource, ImportDashboardState } from '../../../types';

const initialImportDashboardState: ImportDashboardState = {
  gcomDashboard: { dashboard: {}, meta: { updatedAt: '', orgName: '' } },
  jsonDashboard: {},
  source: DashboardSource.Json,
  inputs: [],
  gcomError: '',
  isLoaded: false,
};

const importDashboardSlice = createSlice({
  name: 'manageDashboards',
  initialState: initialImportDashboardState,
  reducers: {
    setGcomDashboard: (state, action: PayloadAction<any>): ImportDashboardState => {
      return {
        ...state,
        gcomDashboard: {
          dashboard: action.payload.json,
          meta: { updatedAt: action.payload.updatedAt, orgName: action.payload.orgName },
        },
        source: DashboardSource.Gcom,
        isLoaded: true,
      };
    },
    setJsonDashboard: (state, action: PayloadAction<any>): ImportDashboardState => {
      return {
        ...state,
        jsonDashboard: action.payload,
        source: DashboardSource.Json,
        isLoaded: true,
      };
    },
    clearDashboard: (state): ImportDashboardState => {
      return {
        ...state,
        gcomDashboard: {},
        jsonDashboard: {},
        isLoaded: false,
      };
    },
    dashboardTitleChange: (state, action: PayloadAction<string>): ImportDashboardState => {
      if (state.source === DashboardSource.Gcom) {
        return {
          ...state,
          gcomDashboard: {
            ...state.gcomDashboard,
            json: {
              ...state.gcomDashboard.json,
              title: action.payload,
            },
          },
        };
      } else {
        return {
          ...state,
          jsonDashboard: {
            ...state.jsonDashboard,
            title: action.payload,
          },
        };
      }
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
  dashboardTitleChange,
} = importDashboardSlice.actions;

export const importDashboardReducer = importDashboardSlice.reducer;

export default {
  importDashboard: importDashboardReducer,
};
