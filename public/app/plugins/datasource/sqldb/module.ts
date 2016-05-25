import SqlDatasource from './datasource';
import {SqlQueryCtrl} from './query_ctrl';

class SqlConfigCtrl {
  static templateUrl = 'partials/config.html';
}

class SqlQueryOptionsCtrl {
  static templateUrl = 'partials/query.options.html';
}

class SqlAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  SqlDatasource as Datasource,
  SqlQueryCtrl as QueryCtrl,
  SqlConfigCtrl as ConfigCtrl,
  SqlQueryOptionsCtrl as QueryOptionsCtrl,
  SqlAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};


