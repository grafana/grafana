import { DashboardLoadedEvent, DataSourcePlugin } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

// @todo: replace barrel import path
import { QueryEditor } from './components/QueryEditor/index';
import { ConfigEditor } from './configuration/ConfigEditor';
import { ElasticDatasource } from './datasource';
import { onDashboardLoadedHandler } from './tracking';
import { ElasticsearchQuery } from './types';

export const plugin = new DataSourcePlugin(ElasticDatasource).setQueryEditor(QueryEditor).setConfigEditor(ConfigEditor);

// Subscribe to on dashboard loaded event so that we can track plugin adoption
getAppEvents().subscribe<DashboardLoadedEvent<ElasticsearchQuery>>(DashboardLoadedEvent, onDashboardLoadedHandler);
