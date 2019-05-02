import { DataQuery, SeriesData, DataSourceJsonData, DataSourceSettings } from '@grafana/ui/src/types';

export interface InputQuery extends DataQuery {
  // Data saved in the panel
  data?: SeriesData[];
}

export interface InputOptions extends DataSourceJsonData {
  // Saved in the datasource and download with bootData
  data?: SeriesData[];
}

export type InputSettings = DataSourceSettings<InputOptions>;
