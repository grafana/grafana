export class PrometheusConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/prometheus/partials/config.html';
  current: any;

  /** @ngInject */
  constructor($scope: any) {
    this.current.jsonData.httpMethod = this.current.jsonData.httpMethod || 'GET';
  }
}
