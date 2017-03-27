import InfluxDatasource from './datasource';
import {InfluxQueryCtrl} from './query_ctrl';
import {InfluxConfigCtrl} from './config_ctrl';

class InfluxQueryOptionsCtrl {
  static templateUrl = 'partials/query.options.html';
}

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  InfluxDatasource as Datasource,
  InfluxQueryCtrl as QueryCtrl,
  InfluxConfigCtrl as ConfigCtrl,
  InfluxQueryOptionsCtrl as QueryOptionsCtrl,
  InfluxAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};


