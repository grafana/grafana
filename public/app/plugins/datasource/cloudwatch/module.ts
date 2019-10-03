import './query_parameter_ctrl';

import CloudWatchDatasource from './datasource';
// import { CloudWatchQueryCtrl } from './query_ctrl';
import { CloudWatchQueryEditor } from './components/QueryEditor';
import { CloudWatchConfigCtrl } from './config_ctrl';

class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  CloudWatchDatasource as Datasource,
  // CloudWatchQueryCtrl as QueryCtrl,
  CloudWatchQueryEditor as QueryEditor,
  CloudWatchConfigCtrl as ConfigCtrl,
  CloudWatchAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
