import appEvents from 'app/core/app_events';
import { QueryCtrl } from 'app/plugins/sdk';

function makeDefaultQuery(database) {
  return `from(db: "${database}")
  |> range($range)
  |> limit(n:1000)
`;
}
export class InfluxIfqlQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  dataPreview: string;
  resultRecordCount: string;
  resultTableCount: string;
  resultFormats: any[];

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);

    this.resultRecordCount = '';
    this.resultTableCount = '';

    if (this.target.query === undefined) {
      this.target.query = makeDefaultQuery(this.datasource.database);
    }
    this.resultFormats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];

    appEvents.on('ds-request-response', this.onResponseReceived, $scope);
    this.panelCtrl.events.on('refresh', this.onRefresh, $scope);
    this.panelCtrl.events.on('data-received', this.onDataReceived, $scope);
  }

  onDataReceived = dataList => {
    this.resultRecordCount = dataList.reduce((count, model) => {
      const records = model.type === 'table' ? model.rows.length : model.datapoints.length;
      return count + records;
    }, 0);
    this.resultTableCount = dataList.length;
  };

  onResponseReceived = response => {
    this.dataPreview = response.data;
  };

  onRefresh = () => {
    this.dataPreview = '';
    this.resultRecordCount = '';
    this.resultTableCount = '';
  };

  getCollapsedText() {
    return this.target.query;
  }
}
