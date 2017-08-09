import {GraphiteDatasource} from './datasource';
import {GraphiteQueryCtrl} from './query_ctrl';
import {GraphiteConfigCtrl} from './config_ctrl';

class GraphiteQueryOptionsCtrl {
  static templateUrl = 'partials/query.options.html';
}

class AnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  GraphiteDatasource as Datasource,
  GraphiteQueryCtrl as QueryCtrl,
  GraphiteConfigCtrl as ConfigCtrl,
  GraphiteQueryOptionsCtrl as QueryOptionsCtrl,
  AnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

