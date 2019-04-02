export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
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

export interface Field {
  name: string; // The column name
  type?: FieldType;
  filterable?: boolean;
  unit?: string;
  dateFormat?: string; // Source data format
}

export interface Labels {
  [key: string]: string;
}

export interface SeriesData {
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

export interface TableData {
  columns: Column[];
  rows: any[][];
}

export type TimeSeriesValue = number | null;

export type TimeSeriesPoints = TimeSeriesValue[][];

export interface TimeSeries {
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
