///<reference path="../../../../headers/common.d.ts" />

import {TestDataDatasource} from './datasource';
import {QueryCtrl} from 'app/plugins/sdk';

export class TestDataQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  scenarioDefs: any;

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);

    this.target.scenario = this.target.scenario || 'random_walk';

    this.scenarioDefs = {
      'random_walk': {text: 'Random Walk'},
      'no_datapoints': {text: 'No Datapoints'},
      'data_outside_range': {text: 'Data Outside Range'},
    };
  }
}

