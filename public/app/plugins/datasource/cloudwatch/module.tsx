import {
  DashboardLoadedEvent,
  DataSourcePlugin,
  DataSourceUpdatedSuccessfully,
  DataSourceUpdateFailed,
} from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import { ConfigEditor } from './components/ConfigEditor';
import LogsCheatSheet from './components/LogsCheatSheet';
import { MetaInspector } from './components/MetaInspector';
import { QueryEditor } from './components/QueryEditor';
import { CloudWatchDatasource } from './datasource';
import {
  onDashboardLoadedHandler,
  onDataSourceUpdatedSuccessfullyHandler,
  onDataSourceUpdateFailedHandler,
} from './tracking';
import { CloudWatchJsonData, CloudWatchQuery } from './types';

export const plugin = new DataSourcePlugin<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>(
  CloudWatchDatasource
)
  .setQueryEditorHelp(LogsCheatSheet)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setMetadataInspector(MetaInspector);

// Tracking Events
getAppEvents().subscribe<DashboardLoadedEvent<CloudWatchQuery>>(DashboardLoadedEvent, onDashboardLoadedHandler);

getAppEvents().subscribe<DataSourceUpdatedSuccessfully>(
  DataSourceUpdatedSuccessfully,
  onDataSourceUpdatedSuccessfullyHandler
);

getAppEvents().subscribe<DataSourceUpdateFailed>(DataSourceUpdateFailed, onDataSourceUpdateFailedHandler);
