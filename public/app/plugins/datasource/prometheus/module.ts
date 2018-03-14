import { PrometheusDatasource } from './datasource';
import { PrometheusQueryCtrl } from './query_ctrl';

class PrometheusConfigCtrl {
  static templateUrl = 'partials/config.html';
}

class PrometheusAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  PrometheusDatasource as Datasource,
  PrometheusQueryCtrl as QueryCtrl,
  PrometheusConfigCtrl as ConfigCtrl,
  PrometheusAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
