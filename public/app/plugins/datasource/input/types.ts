import { DataQuery, SeriesData } from '@grafana/ui/src/types';

export interface InputQuery extends DataQuery {
  // Data saved in the panel
  data?: SeriesData[];
}
