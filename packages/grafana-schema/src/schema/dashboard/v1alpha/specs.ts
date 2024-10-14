import { DataQuery as DataQueryV1, DataSourceRef } from '../../../common/common.gen';
import { DataTransformerConfig, FieldConfigSource } from '../../../raw/dashboard/x/dashboard_types.gen';

export interface VizConfigSpec {
  pluginId: string;
  pluginVersion: string;
  options: Record<string, unknown>;
  fieldConfig: FieldConfigSource;
}

export interface QueryOptionsSpec {}

interface DataQuery extends DataQueryV1 {
  datasource: DataSourceRef; // datasource is required in v2, mixed datasource to be inferred form the queries
}

export interface QueryGroupSpec {
  queries: DataQuery[]; // TODO: kind?
  transformations: DataTransformerConfig[]; // TODO: kind?
  queryOptions: QueryOptionsSpec; // TODO: kind?
}

export interface QuerySpec extends DataQuery {}

// TODO
export interface QueryVariableSpec {}
export interface TextVariableSpec {}

export interface TimeSettingsSpec {
  timezone: string;
  from: string;
  to: string;
  autoRefresh: string; //v1: refresh
  autoRefreshIntervals: string[]; // v1: timepicker.refresh_intervals
  quickRanges: string[]; // v1: timepicker.time_options , not exposed in the UI
  hideTimepicker: boolean; // v1: timepicker.hidden
  weekStart: string;
  fiscalYearStartMonth: number;
  nowDelay?: string; // v1: timepicker.nowDelay
}
