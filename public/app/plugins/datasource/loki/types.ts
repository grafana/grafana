import { DataQuery, Labels, DataSourceJsonData } from '@grafana/ui/src/types';

export interface LokiQuery extends DataQuery {
  expr: string;
  live?: boolean;
  query?: string;
  regexp?: string;
}

export interface LokiOptions extends DataSourceJsonData {
  maxLines?: string;
}

export interface LokiLogsStream {
  labels: string;
  entries: LokiLogsStreamEntry[];
  search?: string;
  parsedLabels?: Labels;
  uniqueLabels?: Labels;
}

export interface LokiLogsStreamEntry {
  line: string;
  ts: string;
  // Legacy, was renamed to ts
  timestamp?: string;
}

export interface LokiExpression {
  regexp: string;
  query: string;
}
