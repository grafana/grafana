import { DataQuery, Labels } from '@grafana/ui/src/types';

export interface LokiQuery extends DataQuery {
  expr: string;
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
