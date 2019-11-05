import { DataSourcePlugin } from '@grafana/data';
import { CloudWatchQueryCtrl } from './query_ctrl';
import { ConfigEditor } from './components/ConfigEditor';
import CloudWatchDatasource from './datasource';
import { CloudWatchJsonData, CloudWatchQuery } from './types';

class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>(
  CloudWatchDatasource
)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(CloudWatchQueryCtrl)
  .setAnnotationQueryCtrl(CloudWatchAnnotationsQueryCtrl);
