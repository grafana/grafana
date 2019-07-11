import { DataQuery, DataSourceJsonData } from '@grafana/ui';
import { DataFrame } from '@grafana/data';

export interface InputQuery extends DataQuery {
  // Data saved in the panel
  data?: DataFrame[];
}

export interface InputOptions extends DataSourceJsonData {
  // Saved in the datasource and download with bootData
  data?: DataFrame[];
}
