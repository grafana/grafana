import { DataQuery, DataSourceJsonData } from '@grafana/ui/src/types';

export enum PromContext {
  Explore = 'explore',
  Panel = 'panel',
}

export interface PromQuery extends DataQuery {
  expr: string;
  context?: PromContext;
  format?: string;
  instant?: boolean;
  hinting?: boolean;
  interval?: string;
  intervalFactor?: number;
  legendFormat?: string;
  valueWithRefId?: boolean;
}

export interface PromOptions extends DataSourceJsonData {
  timeInterval: string;
  queryTimeout: string;
  httpMethod: string;
  directUrl: string;
}

export interface PromQueryRequest extends PromQuery {
  step?: number;
  requestId?: string;
  start: number;
  end: number;
  headers?: any;
}
