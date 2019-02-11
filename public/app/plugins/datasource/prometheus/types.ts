import { DataQuery } from '@grafana/ui/src/types';

export interface PromQuery extends DataQuery {
  expr: string;
  legendFormat?: string;
  interval?: string;
  intervalFactor?: string;
  format?: string;
  instant?: boolean;
}
