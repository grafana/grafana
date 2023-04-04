import { DataSourceRef as CommonDataSourceRef } from '../common/common.gen';
import * as raw from '../raw/dashboard/x/dashboard_types.gen';

export type { CommonDataSourceRef as DataSourceRef };

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
  // TODO remove explicit nulls
  rootStateKey: string | null;
  // TODO remove explicit nulls
  error: any | null;
  // TODO remove explicit nulls
  description: string | null;
  hide: VariableHide;
  // TODO remove explicit nulls
  datasource: CommonDataSourceRef | null;
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

export interface MatcherConfig<TConfig = any> extends raw.MatcherConfig {
  options?: TConfig;
}

export interface DataTransformerConfig<TOptions = any> extends raw.DataTransformerConfig {
  options: TOptions;
}

export const defaultDashboard = raw.defaultDashboard as Dashboard;
export const defaultVariableModel = {
  ...raw.defaultVariableModel,
  // TODO remove explicit nulls
  rootStateKey: null,
  // TODO remove explicit nulls
  error: null,
  // TODO remove explicit nulls
  description: null,
  hide: VariableHide.dontHide,
  state: raw.LoadingState.NotStarted,
  // TODO remove explicit nulls
  datasource: null,
} as VariableModel;
export const defaultPanel: Partial<Panel> = raw.defaultPanel;
export const defaultFieldConfig: Partial<FieldConfig> = raw.defaultFieldConfig;
export const defaultFieldConfigSource: Partial<FieldConfigSource> = raw.defaultFieldConfigSource;
export const defaultMatcherConfig: Partial<MatcherConfig> = raw.defaultMatcherConfig;
