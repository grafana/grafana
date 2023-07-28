import { DataSourceRef as CommonDataSourceRef, DataSourceRef } from '../common/common.gen';
import * as raw from '../raw/dashboard/x/dashboard_types.gen';

import { DataQuery } from './common.types';

export type { CommonDataSourceRef as DataSourceRef };

export interface Panel<TOptions = Record<string, unknown>, TCustomFieldConfig = Record<string, unknown>>
  extends Omit<raw.Panel, 'fieldConfig'> {
  fieldConfig: FieldConfigSource<TCustomFieldConfig>;
}

export interface RowPanel extends Omit<raw.RowPanel, 'panels'> {
  panels: Array<Panel | raw.GraphPanel | raw.HeatmapPanel>;
}

export enum VariableHide {
  dontHide,
  hideLabel,
  hideVariable,
}

export interface VariableModel extends Omit<raw.VariableModel, 'hide' | 'description' | 'datasource'> {
  hide: VariableHide;
  description?: string | null;
  datasource: DataSourceRef | null;
}

export interface Dashboard extends Omit<raw.Dashboard, 'templating' | 'annotations' | 'panels'> {
  panels?: Array<Panel | RowPanel | raw.GraphPanel | raw.HeatmapPanel>;
  annotations?: AnnotationContainer;
  templating?: {
    list?: VariableModel[];
  };
}

export interface AnnotationQuery<TQuery extends DataQuery = DataQuery>
  extends Omit<raw.AnnotationQuery, 'target' | 'datasource'> {
  datasource?: DataSourceRef | null;
  target?: TQuery;
}

export interface AnnotationContainer extends Omit<raw.AnnotationContainer, 'list'> {
  list?: AnnotationQuery[]; // use the version from this file
}

export interface FieldConfig<TOptions = Record<string, unknown>> extends raw.FieldConfig {
  custom?: TOptions & Record<string, unknown>;
}

export interface FieldConfigSource<TOptions = Record<string, unknown>> extends Omit<raw.FieldConfigSource, 'defaults'> {
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
  description: null,
  hide: VariableHide.dontHide,
  datasource: null,
} as VariableModel;
export const defaultPanel: Partial<Panel> = raw.defaultPanel;
export const defaultRowPanel: Partial<Panel> = raw.defaultRowPanel;
export const defaultFieldConfig: Partial<FieldConfig> = raw.defaultFieldConfig;
export const defaultFieldConfigSource: Partial<FieldConfigSource> = raw.defaultFieldConfigSource;
export const defaultMatcherConfig: Partial<MatcherConfig> = raw.defaultMatcherConfig;
export const defaultAnnotationQuery: Partial<AnnotationQuery> = raw.defaultAnnotationQuery as AnnotationQuery;
export const defaultAnnotationContainer: Partial<AnnotationContainer> =
  raw.defaultAnnotationContainer as AnnotationContainer;
