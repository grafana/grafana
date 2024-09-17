import { DashboardLoadedEvent, DataSourcePlugin } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import LokiCheatSheet from './components/LokiCheatSheet';
import LokiQueryEditorByApp from './components/LokiQueryEditorByApp';
import { ConfigEditor } from './configuration/ConfigEditor';
import { LokiDatasource } from './datasource';
import { onDashboardLoadedHandler } from './tracking';
import { LokiQuery } from './types';

export const plugin = new DataSourcePlugin(LokiDatasource)
  .setQueryEditor(LokiQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(LokiCheatSheet);

// Subscribe to on dashboard loaded event so that we can track plugin adoption
getAppEvents().subscribe<DashboardLoadedEvent<LokiQuery>>(DashboardLoadedEvent, onDashboardLoadedHandler);
