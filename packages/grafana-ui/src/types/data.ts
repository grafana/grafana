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
export type TimeSeriesVMs = TimeSeriesVM[];

interface Column {
  text: string;
  title?: string;
  type?: string;
  sort?: boolean;
  desc?: boolean;
  filterable?: boolean;
  unit?: string;
}

export interface TableData {
  columns: Column[];
  rows: any[];
  type: string;
  columnMap: any;
}

export type SingleStatValue = number | string | null;

/*
 * So we can add meta info like tags & series name
 */
export interface SingleStatValueInfo {
  value: SingleStatValue;
}
