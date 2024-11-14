import { DataQuery, DataSourceApi, DataSourceJsonData, DataSourcePlugin } from '@grafana/data';

import { RelativeUrl } from '../alerting/unified/utils/url';

export type GenericDataSourcePlugin = DataSourcePlugin<DataSourceApi<DataQuery, DataSourceJsonData>>;

export type DataSourceRights = {
  readOnly: boolean;
  hasWriteRights: boolean;
  hasDeleteRights: boolean;
};

export type DataSourcesRoutes = {
  New: RelativeUrl;
  Edit: RelativeUrl;
  List: RelativeUrl;
  Dashboards: RelativeUrl;
};

export type DataSourceTestStatus = 'success' | 'warning' | 'error';
