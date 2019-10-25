import { DataQuery, DataSourceJsonData } from '@grafana/ui';

export interface CloudWatchQuery extends DataQuery {
  id: string;
  region: string;
  namespace: string;
  metricName: string;
  dimensions: { [key: string]: string };
  statistics: string[];
  period: string;
  expression: string;
}

export interface CloudWatchOptions extends DataSourceJsonData {
  version: number;
  jsonData: object;
  editorJsonData?: object;
  secureJsonData: object;
  editorSecureJsonData?: object;
}
