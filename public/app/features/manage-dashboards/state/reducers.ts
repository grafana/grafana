import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DataSourceSelectItem } from '@grafana/data';

export enum DashboardSource {
  Gcom = 0,
  Json = 1,
}

export interface ImportDashboardDTO {
  title: string;
  uid: string;
  gnetId: string;
  constants: string[];
  dataSources: DataSourceSelectItem[];
  folder: { id: number; title?: string };
}

export enum InputType {
  DataSource = 'datasource',
  Constant = 'constant',
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
  options: DataSourceSelectItem[];
}

export interface DashboardInputs {
  dataSources: DataSourceInput[];
  constants: DashboardInput[];
}

export interface ImportDashboardState {
  meta: { updatedAt: string; orgName: string };
  dashboard: any;
  source: DashboardSource;
  inputs: DashboardInputs;
  isLoaded: boolean;
}

const initialImportDashboardState: ImportDashboardState = {
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
    setInputs: (state, action: PayloadAction<any[]>): ImportDashboardState => ({
      ...state,
      inputs: {
        dataSources: action.payload.filter(p => p.type === InputType.DataSource),
        constants: action.payload.filter(p => p.type === InputType.Constant),
      },
    }),
  },
});

export const { clearDashboard, setInputs, setGcomDashboard, setJsonDashboard } = importDashboardSlice.actions;

export const importDashboardReducer = importDashboardSlice.reducer;

export default {
  importDashboard: importDashboardReducer,
};
