///<reference path="../../../headers/common.d.ts" />

import './bucket_agg';
import './metric_agg';

import angular from 'angular';
import _ from 'lodash';
import {QueryCtrl} from 'app/plugins/sdk';

export class ElasticQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  esVersion: any;
  fixedSchema: boolean;
  rawQueryOld: string;

  /** @ngInject **/
  constructor($scope, $injector, private $rootScope, private $timeout, private uiSegmentSrv) {
    super($scope, $injector);

    this.esVersion = this.datasource.esVersion;
    this.fixedSchema = this.datasource.fixedSchema;
    this.queryUpdated();
  }

  getMetrics(type) {
      /* When using the fixed schema options, the metrics names are the
         elasticsearch types within the index */
      var data;
      if (this.fixedSchema) {
          var data = this.datasource.getIndexTypes();
      } else {
          var jsonStr = angular.toJson({ find: 'fields', type: type });
          data = this.datasource.metricFindQuery(jsonStr);
      }
      return data
          .then(this.uiSegmentSrv.transformToSegments(false))
          .catch(this.handleQueryError.bind(this));
  }

  getFields(type) {
      /* When using the fixed schema options, the metrics tags are the fields
         defined within the elasticsearch index associated to (arbitrarilly)
         the first metric. */
      var data;
      if (this.fixedSchema) {
          var data = this.datasource.getTags(this.target.metrics[0]['field']);
      } else {
          var jsonStr = angular.toJson({ find: 'fields', type: type });
          data = this.datasource.metricFindQuery(jsonStr);
      }
      return data
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
