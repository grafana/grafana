import appEvents from 'app/core/app_events';
import { QueryCtrl } from 'app/plugins/sdk';

export class StreamingQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  dataPreview: any;

  /** @ngInject */
  constructor($scope: any, $injector: any) {
    super($scope, $injector);

    appEvents.on('ds-request-response', this.onResponseReceived, $scope);
    this.panelCtrl.events.on('refresh', this.onRefresh, $scope);
    this.panelCtrl.events.on('data-received', this.onDataReceived, $scope);
  }

  // Called from the search window
  onKeyPress(event: any) {
    if (event.which === 13) {
      this.panelCtrl.refresh();
    }
  }

  onDataReceived = dataList => {
    // this.resultRecordCount = dataList.reduce((count, model) => {
    //   const records = model.type === 'table' ? model.rows.length : model.datapoints.length;
    //   return count + records;
    // }, 0);
    // this.resultTableCount = dataList.length;
  };

  onResponseReceived = response => {
    this.dataPreview = response.data;
  };

  onRefresh = () => {
    this.dataPreview = '';
  };

  onExecute = () => {
    console.log('refresh metric data', this.target);
    this.panelCtrl.refresh();
  };

  requestMetadata = query => {
    return this.datasource.metricFindQuery(query);
  };

  getCollapsedText() {
    return this.target.query;
  }
}
