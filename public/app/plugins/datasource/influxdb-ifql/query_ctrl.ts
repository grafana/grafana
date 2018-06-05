import { QueryCtrl } from 'app/plugins/sdk';

function makeDefaultQuery(database) {
  return `from(db: "${database}")
  |> range($range)
  |> limit(n:1000)
`;
}
export class InfluxIfqlQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  resultFormats: any[];

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);

    if (this.target.query === undefined) {
      this.target.query = makeDefaultQuery(this.datasource.database);
    }
    this.resultFormats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];
  }

  getCollapsedText() {
    return this.target.query;
  }
}
