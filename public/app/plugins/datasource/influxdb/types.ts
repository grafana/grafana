import { DataQuery, DataSourceJsonData } from '@grafana/data';

export enum InfluxVersion {
  InfluxQL = 'InfluxQL',
  Flux = 'Flux',
}

export interface InfluxOptions extends DataSourceJsonData {
  version?: InfluxVersion;

  timeInterval: string;
  httpMode: string;

  // With Flux
  organization?: string;
  defaultBucket?: string;
  maxSeries?: number;
}

export interface InfluxSecureJsonData {
  // For Flux
  token?: string;

  // In 1x a different password can be sent than then HTTP auth
  password?: string;
}

export interface InfluxQueryPart {
  type: string;
  params?: Array<string | number>;
  interval?: string; // FIXME: is this ever used?
}

export interface InfluxQueryTag {
  key: string;
  operator?: string;
  condition?: string;
  value: string;
}

export type ResultFormat = 'time_series' | 'table' | 'logs';

export interface InfluxQuery extends DataQuery {
  policy?: string;
  measurement?: string;
  resultFormat?: ResultFormat;
  orderByTime?: string;
  tags?: InfluxQueryTag[];
  groupBy?: InfluxQueryPart[];
  select?: InfluxQueryPart[][];
  limit?: string | number;
  slimit?: string | number;
  tz?: string;
  fill?: string;
  rawQuery?: boolean;
  query?: string;
  alias?: string;
}
