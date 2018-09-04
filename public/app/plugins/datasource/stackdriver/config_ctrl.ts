export class StackdriverConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/stackdriver/partials/config.html';
  datasourceSrv: any;
  current: any;

  /** @ngInject */
  constructor($scope, datasourceSrv) {
    this.datasourceSrv = datasourceSrv;
    this.current.jsonData = this.current.jsonData || {};
  }
}
