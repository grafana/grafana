///<reference path="../../../headers/common.d.ts" />

import './bucket_agg';
import './metric_agg';

import angular from 'angular';
import _ from 'lodash';
import {QueryCtrl} from 'app/plugins/sdk';

export class ElasticQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  esVersion: any;
  rawQueryOld: string;

  /** @ngInject **/
  constructor($scope, $injector, private $rootScope, private $timeout, private uiSegmentSrv) {
    super($scope, $injector);

    this.esVersion = this.datasource.esVersion;
    this.queryUpdated();
  }

  getFields(type) {
    var jsonStr = angular.toJson({find: 'fields', type: type});
    return this.datasource.metricFindQuery(jsonStr)
    .then(this.uiSegmentSrv.transformToSegments(false))
    .catch(this.handleQueryError.bind(this));
  }

  queryUpdated() {
    var newJson = angular.toJson(this.datasource.queryBuilder.build(this.target), true);
    if (newJson !== this.rawQueryOld) {
      this.rawQueryOld = newJson;
      this.refresh();
    }

    this.$rootScope.appEvent('elastic-query-updated');
  }

  handleQueryError(err) {
    this.error = err.message || 'Failed to issue metric query';
    return [];
  }
}
