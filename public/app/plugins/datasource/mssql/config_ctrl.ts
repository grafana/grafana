export class MssqlConfigCtrl {
  static templateUrl = 'partials/config.html';

  current: any;

  /** @ngInject */
  constructor($scope) {
    this.current.jsonData.encrypt = this.current.jsonData.encrypt || 'false';
  }
}
