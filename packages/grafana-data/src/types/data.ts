export type KeyValue<T = any> = { [s: string]: T };

export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
  Streaming = 'Streaming',
  Done = 'Done',
  Error = 'Error',
}

export interface QueryResultMeta {
  // Match the result to the query
  requestId?: string;

  // Used in Explore for highlighting
  searchWords?: string[];

  // Used in Explore to show limit applied to search result
  limit?: number;

  // DatasSource Specific Values
  custom?: any;

  // true if old legacy json field values, used to convert back to old json doc formats for old table panel
  json?: boolean;

  // Used to record transformations that where applied
  transformations?: string[];
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
