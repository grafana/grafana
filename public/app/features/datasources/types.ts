import { DataQuery, DataSourceApi, DataSourceJsonData, DataSourcePlugin, DataSourceSettings } from '@grafana/data';

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

export type DataSourceTestStatus = 'success' | 'warning' | 'error';

export type DataSourceInfo = {
  dataSource: DataSourceSettings;
  dataSourcePluginName: string;
  isDefault: boolean;
  isReadOnly: boolean;
  alertingSupported: boolean;
  onUpdate: (dataSource: DataSourceSettings) => Promise<DataSourceSettings>;
};
