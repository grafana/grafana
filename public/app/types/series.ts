import { Moment } from 'moment';

export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
  Done = 'Done',
  Error = 'Error',
}

export interface RawTimeRange {
  from: Moment | string;
  to: Moment | string;
}

export interface TimeRange {
  from: Moment;
  to: Moment;
  raw: RawTimeRange;
}

export type TimeSeriesValue = string | number | null;

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
}

export interface TimeSeriesStats {
  total: number;
  max: number;
  min: number;
  logmin: number;
  avg: number | null;
  current: number | null;
  first: number | null;
  delta: number;
  diff: number | null;
  range: number | null;
  timeStep: number;
  count: number;
  allIsNull: boolean;
  allIsZero: boolean;
}

export enum NullValueMode {
  Null = 'null',
  Ignore = 'connected',
  AsZero = 'null as zero',
}

/** View model projection of many time series */
export interface TimeSeriesVMs {
  [index: number]: TimeSeriesVM;
}

export interface DataQueryResponse {
  data: TimeSeries[];
}

export interface DataQuery {
  refId: string;
}

export interface DataQueryOptions {
  timezone: string;
  range: TimeRange;
  rangeRaw: RawTimeRange;
  targets: DataQuery[];
  panelId: number;
  dashboardId: number;
  cacheTimeout?: string;
  interval: string;
  intervalMs: number;
  maxDataPoints: number;
  scopedVars: object;
}

export interface DataSourceApi {
  query(options: DataQueryOptions): Promise<DataQueryResponse>;
}
