export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
  Done = 'Done',
  Error = 'Error',
}

export type TimeSeriesValue = number | null;

export type TimeSeriesPoints = TimeSeriesValue[][];

export interface TimeSeries {
  target: string;
  datapoints: TimeSeriesPoints;
  unit?: string;
}

/** View model projection of a time series */
export interface TimeSeriesVM {
  label: string;
  color: string;
  data: TimeSeriesValue[][];
  allIsNull: boolean;
  allIsZero: boolean;
}

export enum NullValueMode {
  Null = 'null',
  Ignore = 'connected',
  AsZero = 'null as zero',
}

/** View model projection of many time series */
export type TimeSeriesVMs = TimeSeriesVM[];

export enum ColumnType {
  time = 'time', // or date
  number = 'number',
  string = 'string',
  boolean = 'boolean',
  other = 'other', // Object, Array, etc
}

export interface Column {
  text: string; // The column name
  type?: ColumnType;
  filterable?: boolean;
  unit?: string;
  dateFormat?: string; // Source data format
}

export interface Tags {
  [key: string]: string;
}

export interface TableData {
  name?: string;
  columns: Column[];
  rows: any[][];
  tags?: Tags;
}

export interface AnnotationEvent {
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
  tags?: string;
}
