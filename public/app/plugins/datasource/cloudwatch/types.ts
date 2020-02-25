import { DataQuery, SelectableValue, DataSourceJsonData } from '@grafana/data';

export interface CloudWatchQuery extends DataQuery {
  id: string;
  region: string;
  namespace: string;
  metricName: string;
  dimensions: { [key: string]: string | string[] };
  statistics: string[];
  period: string;
  expression: string;
  alias: string;
  matchExact: boolean;
}

export interface AnnotationQuery extends CloudWatchQuery {
  prefixMatching: boolean;
  actionPrefix: string;
  alarmNamePrefix: string;
}

export type SelectableStrings = Array<SelectableValue<string>>;

export interface CloudWatchJsonData extends DataSourceJsonData {
  timeField?: string;
  assumeRoleArn?: string;
  database?: string;
  customMetricsNamespaces?: string;
}

export interface CloudWatchSecureJsonData {
  accessKey: string;
  secretKey: string;
}
