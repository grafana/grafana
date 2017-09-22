///<reference path="../../../../headers/common.d.ts" />

import _ from 'lodash';

import {QueryCtrl} from 'app/plugins/sdk';

export class TestDataQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  scenarioList: any;
  scenario: any;

  /** @ngInject **/
  constructor($scope, $injector, private backendSrv) {
    super($scope, $injector);

    this.target.scenarioId = this.target.scenarioId || 'random_walk';
    this.scenarioList = [];
  }

  $onInit() {
    return this.backendSrv.get('/api/tsdb/testdata/scenarios').then(res => {
      this.scenarioList = res;
      this.scenario = _.find(this.scenarioList, {id: this.target.scenarioId});
    });
  }

  scenarioChanged() {
    this.scenario = _.find(this.scenarioList, {id: this.target.scenarioId});
    this.target.stringInput = this.scenario.stringInput;
    this.refresh();
  }
}

