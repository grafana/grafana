import { DataQuery } from '@grafana/ui/src/types';

export interface LokiQuery extends DataQuery {
  expr: string;
}

