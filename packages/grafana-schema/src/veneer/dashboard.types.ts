import * as raw from '../raw/dashboard/x/dashboard_types.gen';

export interface Panel<TOptions = Record<string, unknown>, TCustomFieldConfig = Record<string, unknown>>
  extends raw.Panel {
  fieldConfig: FieldConfigSource<TCustomFieldConfig>;
}

export enum VariableHide {
  dontHide,
  hideLabel,
  hideVariable,
}

export interface VariableModel
  extends Omit<raw.VariableModel, 'rootStateKey' | 'error' | 'description' | 'hide' | 'datasource'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
  hide: VariableHide;
  datasource: raw.DataSourceRef | null;
}

export interface Dashboard extends Omit<raw.Dashboard, 'templating'> {
  panels?: Array<Panel | raw.RowPanel | raw.GraphPanel | raw.HeatmapPanel>;
  templating?: {
    list?: VariableModel[];
  };
}

export interface FieldConfig<TOptions = Record<string, unknown>> extends raw.FieldConfig {
  custom?: TOptions & Record<string, unknown>;
}

export interface FieldConfigSource<TOptions = Record<string, unknown>> extends raw.FieldConfigSource {
  defaults: FieldConfig<TOptions>;
}

export const defaultDashboard = raw.defaultDashboard as Dashboard;
export const defaultVariableModel = {
  ...raw.defaultVariableModel,
  rootStateKey: null,
  error: null,
  description: null,
  hide: VariableHide.dontHide,
  state: raw.LoadingState.NotStarted,
  datasource: null,
} as VariableModel;
export const defaultPanel: Partial<Panel> = raw.defaultPanel;
export const defaultFieldConfig: Partial<FieldConfig> = raw.defaultFieldConfig;
export const defaultFieldConfigSource: Partial<FieldConfigSource> = raw.defaultFieldConfigSource;
