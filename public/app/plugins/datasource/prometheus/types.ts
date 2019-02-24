import { DataQuery } from '@grafana/ui/src/types';

export interface PromQuery extends DataQuery {
  expr: string;
}
