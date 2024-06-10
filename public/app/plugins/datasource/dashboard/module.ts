import { DataSourcePlugin } from '@grafana/data';

import { DashboardQueryEditor } from './DashboardQueryEditor';
import { DashboardDatasource } from './datasource';

export const plugin = new DataSourcePlugin(DashboardDatasource).setQueryEditor(DashboardQueryEditor);
