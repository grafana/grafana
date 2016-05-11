///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';

import * as dateMath from 'app/core/utils/datemath';
import {QueryCtrl} from 'app/plugins/sdk';
import {PromQuery, getQueryPartCategories} from './prom_query';

class PrometheusQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  query: any;
  metricSegment: any;
  addQueryPartMenu: any[];
  resolutions: any;
  oldTarget: any;
  suggestMetrics: any;
  linkToPrometheus: any;

  /** @ngInject */
  constructor($scope, $injector, private templateSrv, private uiSegmentSrv) {
    super($scope, $injector);

    this.query = new PromQuery(this.target, templateSrv);

    if (this.target.metric) {
      this.metricSegment = uiSegmentSrv.newSegment(this.target.metric);
    } else {
      this.metricSegment = uiSegmentSrv.newSegment({value: 'select metric', fake: true});
    }

    this.resolutions = _.map([1,2,3,4,5,10], function(f) {
      return {factor: f, label: '1/' + f};
    });

    this.updateLink();
    this.buildQueryPartMenu();
  }

  buildQueryPartMenu() {
    var categories = getQueryPartCategories();
    this.addQueryPartMenu = _.reduce(categories, function(memo, cat, key) {
      var menu = {
        text: key,
        submenu: cat.map(item => {
         return {text: item.type, value: item.type};
        }),
      };
      memo.push(menu);
      return memo;
    }, []);
  }

  addQueryPart(item, subItem) {
    this.query.addQueryPart(item, subItem);
    this.panelCtrl.refresh();
  }

  getMetricOptions() {
    return this.datasource.performSuggestQuery('').then(res => {
      return _.map(res, metric => {
        return this.uiSegmentSrv.newSegment(metric);
      });
    });
  }

  queryChanged() {
    this.target.metric = this.metricSegment.value;
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
    var rangeDiff = Math.ceil((range.to.valueOf() - range.from.valueOf()) / 1000);
    var endTime = range.to.utc().format('YYYY-MM-DD HH:mm');
    var expr = {
      expr: this.templateSrv.replace(this.target.expr, this.panelCtrl.panel.scopedVars),
      range_input: rangeDiff + 's',
      end_input: endTime,
      step_input: '',
      stacked: this.panelCtrl.panel.stack,
      tab: 0
    };
    var hash = encodeURIComponent(JSON.stringify([expr]));
    this.linkToPrometheus = this.datasource.directUrl + '/graph#' + hash;
  }
}

export {PrometheusQueryCtrl};
