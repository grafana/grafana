import { DataQuery, DataSourceJsonData } from '@grafana/ui/src/types';

export interface PromQuery extends DataQuery {
  expr: string;
  container?: 'explore' | 'panel';
  format?: string;
  instant?: boolean;
  hinting?: boolean;
  interval?: string;
  intervalFactor?: number;
}

export interface PromOptions extends DataSourceJsonData {
  timeInterval: string;
  queryTimeout: string;
  httpMethod: string;
  directUrl: string;
}
