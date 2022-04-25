import { DataSourcePlugin } from '@grafana/data';

import { DashboardDatasource } from './datasource';

export const plugin = new DataSourcePlugin(DashboardDatasource);
