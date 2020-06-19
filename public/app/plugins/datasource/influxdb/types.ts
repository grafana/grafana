import { DataQuery, DataSourceJsonData } from '@grafana/data';

export enum InfluxVersion {
  V1x = '1x',
  V2x = '2x',
}

export interface InfluxOptions extends DataSourceJsonData {
  version?: InfluxVersion; // no frontend support

  timeInterval: string;
  httpMode: string;

  // Influx 2.0
  // organization is the 'user' for basic auth, token is the password
  defaultBucket?: string;
  maxSeries?: number;
}

export interface InfluxSecureJsonData {
  basicAuthPassword?: string; // In 2x, this is the token

  // In 1x a different password can be sent than then HTTP auth
  password?: string;
}

export interface InfluxQueryPart {
  type: string;
  params?: string[];
  interval?: string;
}

export interface InfluxQueryTag {
  key: string;
  operator?: string;
  condition?: string;
  value: string;
}

export enum InfluxQueryType {
  Classic = 'Classic', // IFQL query builder
  InfluxQL = 'InfluxQL', // raw ifql
  Flux = 'Flux',
}

export interface InfluxQuery extends DataQuery {
  queryType?: InfluxQueryType;
  policy?: string;
  measurement?: string;
  resultFormat?: 'time_series' | 'table';
  orderByTime?: string;
  tags?: InfluxQueryTag[];
  groupBy?: InfluxQueryPart[];
  select?: InfluxQueryPart[][];
  limit?: string;
  slimit?: string;
  tz?: string;
  fill?: string;
  rawQuery?: boolean; // deprecated (use raw InfluxQL)
  query?: string;
}
