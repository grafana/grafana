import { DataQuery, DataSourceApi, DataSourceJsonData, DataSourcePlugin } from '@grafana/data';

export type GenericDataSourcePlugin = DataSourcePlugin<DataSourceApi<DataQuery, DataSourceJsonData>>;

export type DataSourceRights = {
  readOnly: boolean;
  hasWriteRights: boolean;
  hasDeleteRights: boolean;
};

export type DataSourcesRoutes = {
  New: string;
  Edit: string;
  List: string;
  Dashboards: string;
};
