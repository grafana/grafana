///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';

import * as dateMath from 'app/core/utils/datemath';
import {QueryCtrl} from 'app/plugins/sdk';

class PrometheusQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  metric: any;
  resolutions: any;
  oldTarget: any;
  suggestMetrics: any;
  linkToPrometheus: any;

  /** @ngInject */
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    var target = this.target;
    target.expr = target.expr || '';
    target.intervalFactor = target.intervalFactor || 2;

    this.metric = '';
    this.resolutions = _.map([1,2,3,4,5,10], function(f) {
      return {factor: f, label: '1/' + f};
    });

    $scope.$on('typeahead-updated', () => {
      this.$scope.$apply(() => {

        this.target.expr += this.target.metric;
        this.metric = '';
        this.refreshMetricData();
      });
    });

    // called from typeahead so need this
    // here in order to ensure this ref
    this.suggestMetrics = (query, callback) => {
      console.log(this);
      this.datasource.performSuggestQuery(query).then(callback);
    };

    this.updateLink();
  }

  refreshMetricData() {
    if (!_.isEqual(this.oldTarget, this.target)) {
      this.oldTarget = angular.copy(this.target);
      this.panelCtrl.refresh();
      this.updateLink();
    }
  }

  updateLink() {
    var range = this.panelCtrl.range;
    if (!range) {
      return;
    }

    var rangeDiff = Math.ceil((range.to.valueOf() - range.from.valueOf()) / 1000);
    var endTime = range.to.utc().format('YYYY-MM-DD HH:mm');
    var expr = {
      expr: this.templateSrv.replace(this.target.expr, this.panelCtrl.panel.scopedVars, this.datasource.interpolateQueryExpr),
      range_input: rangeDiff + 's',
      end_input: endTime,
      step_input: this.target.step,
      stacked: this.panelCtrl.panel.stack,
      tab: 0
    };
    var hash = encodeURIComponent(JSON.stringify([expr]));
    this.linkToPrometheus = this.datasource.directUrl + '/graph#' + hash;
  }

  getCollapsedText() {
    return this.target.expr;
  }
}

export {PrometheusQueryCtrl};
