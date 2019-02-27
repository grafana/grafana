import { DataQuery } from '@grafana/ui/src/types';

export interface LokiQuery extends DataQuery {
  expr: string;
  resultFormat?: LokiQueryResultFormats;
}

export type LokiQueryResultFormats = 'time_series' | 'logs';
