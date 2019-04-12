import { DataQuery, SeriesData } from '@grafana/ui/src/types';

export interface InputQuery extends DataQuery {
  // Save data in the panel
  data?: SeriesData[];
}
