import {InfluxDatasource} from './datasource';
import {InfluxQueryCtrl} from './query_ctrl';

class InfluxConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/influxdb/partials/config.html';
}

class InfluxQueryOptionsCtrl {
  static templateUrl = 'public/app/plugins/datasource/influxdb/partials/query.options.html';
}

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'public/app/plugins/datasource/influxdb/partials/annotations.editor.html';
}

export {
  InfluxDatasource as Datasource,
  InfluxQueryCtrl as QueryCtrl,
  InfluxConfigCtrl as ConfigCtrl,
  InfluxQueryOptionsCtrl as QueryOptionsCtrl,
  InfluxAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};


