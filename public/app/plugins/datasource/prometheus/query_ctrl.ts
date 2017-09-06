///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';

import * as dateMath from 'app/core/utils/datemath';
import {QueryCtrl} from 'app/plugins/sdk';
import {PromCompleter} from './completer';

class PrometheusQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  metric: any;
  resolutions: any;
  formats: any;
  oldTarget: any;
  suggestMetrics: any;
  getMetricsAutocomplete: any;
  linkToPrometheus: any;

  /** @ngInject */
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    var target = this.target;
    target.expr = target.expr || '';
    target.intervalFactor = target.intervalFactor || 2;
    target.format = target.format || this.getDefaultFormat();

    this.metric = '';
    this.resolutions = _.map([1,2,3,4,5,10], function(f) {
      return {factor: f, label: '1/' + f};
    });

    this.formats = [
      {text: 'Time series', value: 'time_series'},
      {text: 'Table', value: 'table'},
    ];

    this.updateLink();
  }

  getCompleter(query) {
    return new PromCompleter(this.datasource);
    // console.log('getquery);
    // return this.datasource.performSuggestQuery(query).then(res => {
    //   return res.map(item => {
    //     return {word: item, type: 'metric'};
    //   });
    // });
  }

  getDefaultFormat() {
    if (this.panelCtrl.panel.type === 'table') {
      return 'table';
    }
    return 'time_series';
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
      'g0.expr': this.templateSrv.replace(this.target.expr, this.panelCtrl.panel.scopedVars, this.datasource.interpolateQueryExpr),
      'g0.range_input': rangeDiff + 's',
      'g0.end_input': endTime,
      'g0.step_input': this.target.step,
      'g0.stacked': this.panelCtrl.panel.stack ? 1 : 0,
      'g0.tab': 0
    };
    var args = _.map(expr, (v, k) => { return k + '=' + encodeURIComponent(v); }).join('&');
    this.linkToPrometheus = this.datasource.directUrl + '/graph?' + args;
  }

  getCollapsedText() {
    return this.target.expr;
  }
}

export {PrometheusQueryCtrl};
