import './query_parameter_ctrl';
import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './components/ConfigEditor';
import { CloudWatchDatasource } from './datasource';
import { CloudWatchAnnotationsQueryCtrl } from './annotations_query_ctrl';
import { CloudWatchJsonData, CloudWatchQuery } from './types';
import { CloudWatchLogsQueryEditor } from './components/LogsQueryEditor';
import { PanelQueryEditor } from './components/PanelQueryEditor';
import LogsCheatSheet from './components/LogsCheatSheet';
import { CombinedMetricsEditor } from './components/CombinedMetricsEditor';

export const plugin = new DataSourcePlugin<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>(
  CloudWatchDatasource
)
  .setExploreStartPage(LogsCheatSheet)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(PanelQueryEditor)
  .setExploreMetricsQueryField(CombinedMetricsEditor)
  .setExploreLogsQueryField(CloudWatchLogsQueryEditor)
  .setAnnotationQueryCtrl(CloudWatchAnnotationsQueryCtrl);
