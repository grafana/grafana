export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
  Done = 'Done',
  Error = 'Error',
}

/** [value:any, unixtimestamp:number] */
export type TimeSeriesValue = number | null;

export type TimeSeriesPoints = TimeSeriesValue[][];

export interface FieldInfo {
  text?: string; // the field name
  title?: string; // display string
  type?: 'time' | 'number' | 'string' | 'object';
  filterable?: boolean;
  unit?: string; // format key
}

export interface TimeSeries extends FieldInfo {
  target: string;
  datapoints: TimeSeriesPoints;
}

/** View model projection of a time series */
export interface TimeSeriesVM {
  label: string;
  color: string;
  data: TimeSeriesValue[][];
  stats: TimeSeriesStats;
  allIsNull: boolean;
  allIsZero: boolean;
}

export interface TimeSeriesStats {
  [key: string]: number | null;
  total: number | null;
  max: number | null;
  min: number | null;
  logmin: number;
  avg: number | null;
  current: number | null;
  first: number | null;
  delta: number;
  diff: number | null;
  range: number | null;
  timeStep: number;
  count: number;
}

export enum NullValueMode {
  Null = 'null',
  Ignore = 'connected',
  AsZero = 'null as zero',
}

/** View model projection of many time series */
export interface TimeSeriesVMs {
  [index: number]: TimeSeriesVM;
  length: number;
}

export interface TableData {
  columns: FieldInfo[];
  rows: any[];
  type: string; // ?? always = 'table' right?
  columnMap: Map<string, FieldInfo>;
}
