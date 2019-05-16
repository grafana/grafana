import { DataQuery, DataSourceJsonData } from '@grafana/ui/src/types';

export interface PromQuery extends DataQuery {
  expr: string;
}

export interface PromOptions extends DataSourceJsonData {
  timeInterval: string;
  queryTimeout: string;
  httpMethod: string;
  directUrl: string;
}
