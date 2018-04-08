import { PrometheusDatasource } from './datasource';
import { PrometheusQueryCtrl } from './query_ctrl';
import { PrometheusConfigCtrl } from './config_ctrl';

class PrometheusAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  PrometheusDatasource as Datasource,
  PrometheusQueryCtrl as QueryCtrl,
  PrometheusConfigCtrl as ConfigCtrl,
  PrometheusAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
