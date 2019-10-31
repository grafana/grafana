import { DataSourcePlugin } from '@grafana/data';
import { CloudWatchQueryCtrl } from './query_ctrl';
import Datasource from './datasource';
import { ConfigEditor } from './components/ConfigEditor';

class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(Datasource)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(CloudWatchQueryCtrl)
  .setAnnotationQueryCtrl(CloudWatchAnnotationsQueryCtrl);
