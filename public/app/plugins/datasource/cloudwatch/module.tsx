import { DataSourcePlugin } from '@grafana/ui';
import { CloudWatchQueryCtrl } from './query_ctrl';
import Datasource from './datasource';
import { ConfigEditor } from './ConfigEditor';

class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(Datasource)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(CloudWatchQueryCtrl)
  .setAnnotationQueryCtrl(CloudWatchAnnotationsQueryCtrl);
