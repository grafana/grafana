import {GraphiteDatasource} from './datasource';
import {GraphiteQueryCtrl} from './query_ctrl';

class GraphiteConfigCtrl {
  static templateUrl = 'partials/config.html';
}

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

