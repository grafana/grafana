import './query_parameter_ctrl';

import {CloudWatchDatasource} from './datasource';
import {CloudWatchQueryCtrl} from './query_ctrl';

class CloudWatchConfigCtrl {
  static templateUrl = 'partials/config.html';
}

class CloudWatchAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  CloudWatchDatasource as Datasource,
  CloudWatchQueryCtrl as QueryCtrl,
  CloudWatchConfigCtrl as ConfigCtrl,
  CloudWatchAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

