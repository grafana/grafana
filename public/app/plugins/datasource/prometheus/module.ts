import {PrometheusDatasource} from './datasource';
import {PrometheusQueryCtrl} from './query_ctrl';




  // function metricsQueryEditor() {
  //   return {controller: 'PrometheusQueryCtrl', templateUrl: 'public/app/plugins/datasource/prometheus/partials/query.editor.html'};
  // }
  //
  // function configView() {
  //   return {templateUrl: ''};
  // }

class PrometheusConfigViewCtrl {
  static templateUrl = 'public/app/plugins/datasource/prometheus/partials/config.html';
}

export {
  PrometheusDatasource as Datasource,
  PrometheusQueryCtrl as MetricsQueryEditor,
  PrometheusConfigViewCtrl as ConfigView
};
