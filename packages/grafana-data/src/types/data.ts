import { FieldConfig } from './dataFrame';
import { DataTransformerConfig } from './transformations';
import { ApplyFieldOverrideOptions } from './fieldOverrides';

export type KeyValue<T = any> = { [s: string]: T };

/**
 * Represent panel data loading state.
 */
export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
  Streaming = 'Streaming',
  Done = 'Done',
  Error = 'Error',
}

export interface QueryResultMeta {
  /** DatasSource Specific Values */
  custom?: Record<string, any>;

  /** Stats */
  stats?: QueryResultMetaStat[];

  /** Meta Notices */
  notices?: QueryResultMetaNotice[];

  /** Used to track transformation ids that where part of the processing */
  transformations?: string[];

  /**
   * Legacy data source specific, should be moved to custom
   * */
  gmdMeta?: any[]; // used by cloudwatch
  rawQuery?: string; // used by stackdriver
  alignmentPeriod?: string; // used by stackdriver
  query?: string; // used by azure log
  searchWords?: string[]; // used by log models and loki
  limit?: number; // used by log models and loki
  json?: boolean; // used to keep track of old json doc values
}

export interface QueryResultMetaStat extends FieldConfig {
  title: string;
  value: number;
}

export interface QueryResultMetaNotice {
  severity: 'info' | 'warning' | 'error';
  text: string;
  url?: string;
  inspect?: 'meta' | 'error' | 'data' | 'stats';
}

export interface QueryResultBase {
  /**
   * Matches the query target refId
   */
  refId?: string;

  /**
   * Used by some backend data sources to communicate back info about the execution (generated sql, timing)
   */
  meta?: QueryResultMeta;
}

export interface Labels {
  [key: string]: string;
}

export interface Column {
  text: string; // For a Column, the 'text' is the field name
  filterable?: boolean;
  unit?: string;
}

export interface TableData extends QueryResultBase {
  name?: string;
  columns: Column[];
  rows: any[][];
  type?: string;
}

export type TimeSeriesValue = number | null;

export type TimeSeriesPoints = TimeSeriesValue[][];

export interface TimeSeries extends QueryResultBase {
  target: string;
  datapoints: TimeSeriesPoints;
  unit?: string;
  tags?: Labels;
}

export enum NullValueMode {
  Null = 'null',
  Ignore = 'connected',
  AsZero = 'null as zero',
}

export interface AnnotationEvent {
  id?: string;
  annotation?: any;
  dashboardId?: number;
  panelId?: number;
  userId?: number;
  login?: string;
  email?: string;
  avatarUrl?: string;
  time?: number;
  timeEnd?: number;
  isRegion?: boolean;
  title?: string;
  text?: string;
  type?: string;
  tags?: string[];

  // Currently used to merge annotations from alerts and dashboard
  source?: any; // source.type === 'dashboard'
}

/**
 * Describes and API for exposing panel specific data configurations.
 */
export interface DataConfigSource {
  getTransformations: () => DataTransformerConfig[] | undefined;
  getFieldOverrideOptions: () => ApplyFieldOverrideOptions | undefined;
}
