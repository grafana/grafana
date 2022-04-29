import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './components/ConfigEditor';
import LogsCheatSheet from './components/LogsCheatSheet';
import { CloudWatchLogsQueryEditor } from './components/LogsQueryEditor';
import { MetaInspector } from './components/MetaInspector';
import { PanelQueryEditor } from './components/PanelQueryEditor';
import { CloudWatchDatasource } from './datasource';
import { CloudWatchJsonData, CloudWatchQuery } from './types';

export const plugin = new DataSourcePlugin<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>(
  CloudWatchDatasource
)
  .setQueryEditorHelp(LogsCheatSheet)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(PanelQueryEditor)
  .setMetadataInspector(MetaInspector)
  .setExploreMetricsQueryField(PanelQueryEditor)
  .setExploreLogsQueryField(CloudWatchLogsQueryEditor);
