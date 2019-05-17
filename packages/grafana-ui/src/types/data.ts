export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
  Streaming = 'Streaming',
  Done = 'Done',
  Error = 'Error',
}

export enum FieldType {
  time = 'time', // or date
  number = 'number',
  string = 'string',
  boolean = 'boolean',
  other = 'other', // Object, Array, etc
}

export interface QueryResultMeta {
  [key: string]: any;

  // Match the result to the query
  requestId?: string;

  // Used in Explore for highlighting
  searchWords?: string[];

  // Used in Explore to show limit applied to search result
  limit?: number;
}

export interface QueryResultBase {
  /**
   * Matches the query target refId
   */
  refId?: string;

  /**
   * Used by some backend datasources to communicate back info about the execution (generated sql, timing)
   */
  meta?: QueryResultMeta;
}

export interface Field {
  name: string; // The column name
  title?: string; // The display value for this field.  This supports template variables blank is auto
  type?: FieldType;
  filterable?: boolean;
  unit?: string;
  dateFormat?: string; // Source data format
  decimals?: number | null; // Significant digits (for display)
  min?: number | null;
  max?: number | null;
}

export interface Labels {
  [key: string]: string;
}

export interface SeriesData extends QueryResultBase {
  name?: string;
  fields: Field[];
  rows: any[][];
  labels?: Labels;
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
  time?: number;
  timeEnd?: number;
  isRegion?: boolean;
  title?: string;
  text?: string;
  type?: string;
  tags?: string[];
}
