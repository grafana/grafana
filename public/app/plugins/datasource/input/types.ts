import { DataQuery, DataSourceJsonData, DataFrameDTO } from '@grafana/data';

export interface InputQuery extends DataQuery {
  // Data saved in the panel
  data?: DataFrameDTO[];
}

export interface InputOptions extends DataSourceJsonData {
  // Saved in the datasource and download with bootData
  data?: DataFrameDTO[];
}
