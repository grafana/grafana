import { DataQuery as DataQueryV1, DataSourceRef } from '../../../common/common.gen';
import { DataTransformerConfig, FieldConfigSource } from '../../../raw/dashboard/x/dashboard_types.gen';

import { Kind } from './common';

export interface VizConfigSpec {
  pluginVersion: string;
  options: Record<string, unknown>;
  fieldConfig: FieldConfigSource;
}

export interface QueryOptionsSpec {
  timeFrom?: string;
  maxDataPoints?: number;
  timeShift?: string;
  queryCachingTTL?: number;
  interval?: string;
  cacheTimeout?: string;
}

interface DataQuery extends DataQueryV1 {
  datasource: DataSourceRef; // datasource is required in v2, mixed datasource to be inferred form the queries
}

/**
 * For example:
 * {
 *  kind: 'PrometheusQuery',
 *  spec: {
 *   datasource: { uid: 'skdjkasjdkj', type: 'prometheus' },
 *   ...
 *  }
 */
type DataQueryKind = Kind<string, DataQuery>;

/**
 * For example:
 * {
 *  kind: 'limitTransformation',
 *  spec: {
 
 *   ...
 *  }
 */
type TransformationKind = Kind<string, DataTransformerConfig>; // keeping it open for

export interface QueryGroupSpec {
  queries: DataQueryKind[];
  transformations: TransformationKind[];
  queryOptions: QueryOptionsSpec;
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
