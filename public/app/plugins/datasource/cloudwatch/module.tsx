import { DashboardLoadedEvent, DataSourcePlugin } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import LogsCheatSheet from './components/CheatSheet/LogsCheatSheet';
import { ConfigEditor } from './components/ConfigEditor/ConfigEditor';
import { MetaInspector } from './components/MetaInspector/MetaInspector';
import { QueryEditor } from './components/QueryEditor/QueryEditor';
import { CloudWatchDatasource } from './datasource';
import { onDashboardLoadedHandler } from './tracking';
import { CloudWatchJsonData, CloudWatchQuery } from './types';

export const plugin = new DataSourcePlugin<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>(
  CloudWatchDatasource
)
  .setQueryEditorHelp(LogsCheatSheet)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setMetadataInspector(MetaInspector);

// Subscribe to on dashboard loaded event so that we can track plugin adoption
getAppEvents().subscribe<DashboardLoadedEvent<CloudWatchQuery>>(DashboardLoadedEvent, onDashboardLoadedHandler);
