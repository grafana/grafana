import { DashboardDatasource } from './datasource';
import { DataSourcePlugin } from '@grafana/ui';

export const plugin = new DataSourcePlugin(DashboardDatasource);
