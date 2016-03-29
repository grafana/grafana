import {PrometheusDatasource} from './datasource';
import {PrometheusQueryCtrl} from './query_ctrl';

class PrometheusConfigCtrl {
  static templateUrl = 'partials/config.html';
}

class PrometheusAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

class PrometheusQueryOptionsCtrl {
  static templateUrl = 'partials/query.options.html';
}

export {
  PrometheusDatasource as Datasource,
  PrometheusQueryCtrl as QueryCtrl,
  PrometheusConfigCtrl as ConfigCtrl,
  PrometheusQueryOptionsCtrl as QueryOptionsCtrl,
  PrometheusAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
