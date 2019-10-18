import CloudWatchDatasource from './datasource';
import { CloudWatchQueryEditor } from './components/QueryEditor';
import { CloudWatchConfigCtrl } from './config_ctrl';

class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  CloudWatchDatasource as Datasource,
  CloudWatchQueryEditor as QueryEditor,
  CloudWatchConfigCtrl as ConfigCtrl,
  CloudWatchAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
