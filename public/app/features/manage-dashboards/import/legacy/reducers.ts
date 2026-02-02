// Legacy Redux slice - will be removed when kubernetesDashboards feature is removed
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSlice, Draft, PayloadAction } from '@reduxjs/toolkit';

import { LoadingState } from '@grafana/data';

import { DashboardInputs, DashboardSource, InputType, LibraryPanelInput } from '../../types';

// Legacy-only type - Redux state shape
export interface ImportDashboardState {
  meta: { updatedAt: string; orgName: string };
  dashboard: any;
  source: DashboardSource;
  inputs: DashboardInputs;
  state: LoadingState;
}

export const initialImportDashboardState: ImportDashboardState = {
  meta: { updatedAt: '', orgName: '' },
  dashboard: {},
  source: DashboardSource.Json,
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  inputs: {} as DashboardInputs,
  state: LoadingState.NotStarted,
};

const importDashboardSlice = createSlice({
  name: 'manageDashboards',
  initialState: initialImportDashboardState,
  reducers: {
    setGcomDashboard: (state: Draft<ImportDashboardState>, action: PayloadAction<any>) => {
      state.dashboard = {
        ...action.payload.json,
        id: null,
      };
      state.meta = { updatedAt: action.payload.updatedAt, orgName: action.payload.orgName };
      state.source = DashboardSource.Gcom;
      state.state = LoadingState.Done;
    },
    setJsonDashboard: (state: Draft<ImportDashboardState>, action: PayloadAction<any>) => {
      state.dashboard = {
        ...action.payload,
        id: null,
      };
      state.meta = initialImportDashboardState.meta;
      state.source = DashboardSource.Json;
      state.state = LoadingState.Done;
    },
    clearDashboard: (state: Draft<ImportDashboardState>) => {
      state.dashboard = {};
      state.state = LoadingState.NotStarted;
    },
    setInputs: (state: Draft<ImportDashboardState>, action: PayloadAction<any[]>) => {
      state.inputs = {
        dataSources: action.payload.filter((p) => p.type === InputType.DataSource),
        constants: action.payload.filter((p) => p.type === InputType.Constant),
        libraryPanels: state.inputs.libraryPanels || [],
      };
    },
    setLibraryPanelInputs: (state: Draft<ImportDashboardState>, action: PayloadAction<LibraryPanelInput[]>) => {
      state.inputs.libraryPanels = action.payload;
    },
    fetchFailed: (state: Draft<ImportDashboardState>) => {
      state.dashboard = {};
      state.state = LoadingState.Error;
    },
    fetchDashboard: (state: Draft<ImportDashboardState>) => {
      state.state = LoadingState.Loading;
    },
  },
});

export const {
  clearDashboard,
  setInputs,
  setGcomDashboard,
  setJsonDashboard,
  setLibraryPanelInputs,
  fetchFailed,
  fetchDashboard,
} = importDashboardSlice.actions;

export const importDashboardReducer = importDashboardSlice.reducer;

export default {
  importDashboard: importDashboardReducer,
};
