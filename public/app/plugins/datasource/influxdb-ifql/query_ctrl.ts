import { QueryCtrl } from 'app/plugins/sdk';

export class InfluxQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  resultFormats: any[];

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);
    this.resultFormats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];
  }

  getCollapsedText() {
    return this.target.query;
  }
}
