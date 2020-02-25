import './query_parameter_ctrl';
import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import CloudWatchDatasource from './datasource';
import { CloudWatchAnnotationsQueryCtrl } from './annotations_query_ctrl';
import { CloudWatchJsonData, CloudWatchQuery } from './types';

export const plugin = new DataSourcePlugin<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>(
  CloudWatchDatasource
)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setExploreQueryField(QueryEditor)
  .setAnnotationQueryCtrl(CloudWatchAnnotationsQueryCtrl);
