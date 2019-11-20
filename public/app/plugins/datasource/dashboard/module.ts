import { DashboardDatasource } from './datasource';
import { DataSourcePlugin } from '@grafana/data';

export const plugin = new DataSourcePlugin(DashboardDatasource);
