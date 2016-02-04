import {PrometheusDatasource} from './datasource';
import {PrometheusQueryCtrl} from './query_ctrl';

class PrometheusConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/prometheus/partials/config.html';
}

export {
  PrometheusDatasource as Datasource,
  PrometheusQueryCtrl as QueryCtrl,
  PrometheusConfigCtrl as ConfigCtrl
};
