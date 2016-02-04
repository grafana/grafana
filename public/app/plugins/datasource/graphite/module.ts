import {GraphiteDatasource} from './datasource';
import {GraphiteQueryCtrl} from './query_ctrl';

class GraphiteConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/graphite/partials/config.html';
}

class GraphiteQueryOptionsCtrl {
  static templateUrl = 'public/app/plugins/datasource/graphite/partials/query.options.html';
}

class AnnotationsQueryCtrl {
  static templateUrl = 'public/app/plugins/datasource/graphite/partials/annotations.editor.html';
}

export {
  GraphiteDatasource as Datasource,
  GraphiteQueryCtrl as QueryCtrl,
  GraphiteConfigCtrl as ConfigCtrl,
  GraphiteQueryOptionsCtrl as QueryOptionsCtrl,
  AnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

