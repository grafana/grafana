import './query_parameter_ctrl';
import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './components/ConfigEditor';
import { MetricsQueryEditor } from './components/MetricsQueryEditor';
import { CloudWatchDatasource } from './datasource';
import { CloudWatchAnnotationsQueryCtrl } from './annotations_query_ctrl';
import { CloudWatchJsonData, CloudWatchQuery } from './types';
import { CloudWatchLogsQueryEditor } from './components/LogsQueryEditor';
import { PanelQueryEditor } from './components/PanelQueryEditor';

export const plugin = new DataSourcePlugin<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>(
  CloudWatchDatasource
)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(PanelQueryEditor)
  .setExploreMetricsQueryField(MetricsQueryEditor)
  .setExploreLogsQueryField(CloudWatchLogsQueryEditor)
  .setAnnotationQueryCtrl(CloudWatchAnnotationsQueryCtrl);
