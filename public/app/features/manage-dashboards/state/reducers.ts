import { createSlice, Draft, PayloadAction } from '@reduxjs/toolkit';
import { DataSourceInstanceSettings } from '@grafana/data';
import { LibraryElementDTO } from '../../library-panels/types';

export enum DashboardSource {
  Gcom = 0,
  Json = 1,
}

export interface ImportDashboardDTO {
  title: string;
  uid: string;
  gnetId: string;
  constants: string[];
  dataSources: DataSourceInstanceSettings[];
  elements: LibraryElementDTO[];
  folder: { id: number; title?: string };
}

export enum InputType {
  DataSource = 'datasource',
  Constant = 'constant',
  LibraryPanel = 'libraryPanel',
}

export enum LibraryPanelInputState {
  New = 'new',
  Exits = 'exists',
  Different = 'different',
}

export interface DashboardInput {
  name: string;
  label: string;
  info: string;
  value: string;
  type: InputType;
}

export interface DataSourceInput extends DashboardInput {
  pluginId: string;
}

export interface LibraryPanelInput {
  model: LibraryElementDTO;
  state: LibraryPanelInputState;
}

export interface DashboardInputs {
  dataSources: DataSourceInput[];
  constants: DashboardInput[];
  libraryPanels: LibraryPanelInput[];
}

export interface ImportDashboardState {
  meta: { updatedAt: string; orgName: string };
  dashboard: any;
  source: DashboardSource;
  inputs: DashboardInputs;
  isLoaded: boolean;
}

export const initialImportDashboardState: ImportDashboardState = {
  meta: { updatedAt: '', orgName: '' },
  dashboard: {},
  source: DashboardSource.Json,
  inputs: {} as DashboardInputs,
  isLoaded: false,
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
      state.isLoaded = true;
    },
    setJsonDashboard: (state: Draft<ImportDashboardState>, action: PayloadAction<any>) => {
      state.dashboard = {
        ...action.payload,
        id: null,
      };
      state.meta = initialImportDashboardState.meta;
      state.source = DashboardSource.Json;
      state.isLoaded = true;
    },
    clearDashboard: (state: Draft<ImportDashboardState>) => {
      state.dashboard = {};
      state.isLoaded = false;
    },
    setInputs: (state: Draft<ImportDashboardState>, action: PayloadAction<any[]>) => {
      state.inputs = {
        dataSources: action.payload.filter((p) => p.type === InputType.DataSource),
        constants: action.payload.filter((p) => p.type === InputType.Constant),
        libraryPanels: [],
      };
    },
    setLibraryPanelInputs: (state: Draft<ImportDashboardState>, action: PayloadAction<LibraryPanelInput[]>) => {
      state.inputs.libraryPanels = action.payload;
    },
  },
});

export const {
  clearDashboard,
  setInputs,
  setGcomDashboard,
  setJsonDashboard,
  setLibraryPanelInputs,
} = importDashboardSlice.actions;

export const importDashboardReducer = importDashboardSlice.reducer;

export default {
  importDashboard: importDashboardReducer,
};
