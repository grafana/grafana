import { DataQuery, DataFrame, DataSourceJsonData } from '@grafana/ui/src/types';

export interface InputQuery extends DataQuery {
  // Data saved in the panel
  data?: DataFrame[];
}

export interface InputOptions extends DataSourceJsonData {
  // Saved in the datasource and download with bootData
  data?: DataFrame[];
}
