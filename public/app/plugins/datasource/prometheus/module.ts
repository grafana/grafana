import {PrometheusDatasource} from './datasource';
import {PrometheusQueryCtrl} from './query_ctrl';

class PrometheusConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/prometheus/partials/config.html';
}

class PrometheusAnnotationsQueryCtrl {
  static templateUrl = 'public/app/plugins/datasource/prometheus/partials/annotations.editor.html';
}

export {
  PrometheusDatasource as Datasource,
  PrometheusQueryCtrl as QueryCtrl,
  PrometheusConfigCtrl as ConfigCtrl,
  PrometheusAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
