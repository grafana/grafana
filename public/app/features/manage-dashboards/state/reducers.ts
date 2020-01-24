import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ImportDashboardState } from '../../../types';

const initialImportDashboardState: ImportDashboardState = {
  dashboard: {},
  inputs: [],
  gcomError: '',
};

const importDashboardSlice = createSlice({
  name: 'manageDashboards',
  initialState: initialImportDashboardState,
  reducers: {
    setGcomDashboard: (state, action: PayloadAction<any>): ImportDashboardState => {
      return {
        ...state,
        dashboard: action.payload,
      };
    },
    clearDashboard: (state): ImportDashboardState => {
      return {
        ...state,
        dashboard: {},
      };
    },
    dashboardTitleChange: (state, action: PayloadAction<string>): ImportDashboardState => {
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          json: {
            ...state.dashboard.json,
            title: action.payload,
          },
        },
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
  setGcomError,
  dashboardTitleChange,
} = importDashboardSlice.actions;

export const importDashboardReducer = importDashboardSlice.reducer;

export default {
  importDashboard: importDashboardReducer,
};
