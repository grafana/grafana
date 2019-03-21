import _ from 'lodash';

export class MetaQueriesConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/metaqueries/partials/config.html';
  current: any;
  datasourceSrv: any;

  /** @ngInject */
  constructor($scope, datasourceSrv) {
    this.datasourceSrv = datasourceSrv;
    this.current.jsonData = this.current.jsonData || {};
  }
}
