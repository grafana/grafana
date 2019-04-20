import { DashboardDatasource } from './datasource';
import { DataSourcePlugin } from '@grafana/ui';
import DashboardQueryEditor from './DashboardQueryEditor';

export const plugin = new DataSourcePlugin(DashboardDatasource).setQueryEditor(DashboardQueryEditor);
