import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface InfluxOptions extends DataSourceJsonData {
  timeInterval: string;
  httpMode: string;

  // Influx 2.0
  enableFlux?: boolean;
  organization?: string;
  defaultBucket?: string;
  maxSeries?: number;
}

export interface InfluxSecureJsonData {
  password?: string;
  token?: string;
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
