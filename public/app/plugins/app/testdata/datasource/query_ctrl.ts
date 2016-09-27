///<reference path="../../../../headers/common.d.ts" />

import {TestDataDatasource} from './datasource';
import {QueryCtrl} from 'app/plugins/sdk';

export class TestDataQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  scenarioList: any;

  /** @ngInject **/
  constructor($scope, $injector, private backendSrv) {
    super($scope, $injector);

    this.target.scenarioId = this.target.scenarioId || 'random_walk';
    this.scenarioList = [];
  }

  $onInit() {
    return this.backendSrv.get('/api/tsdb/testdata/scenarios').then(res => {
      this.scenarioList = res;
    });
  }
}

