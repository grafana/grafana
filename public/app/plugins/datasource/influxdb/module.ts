import InfluxDatasource from './datasource';
import {InfluxQueryCtrl} from './query_ctrl';

class InfluxConfigCtrl {
  static templateUrl = 'partials/config.html';
}

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  InfluxDatasource as Datasource,
  InfluxQueryCtrl as QueryCtrl,
  InfluxConfigCtrl as ConfigCtrl,
  InfluxAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};


