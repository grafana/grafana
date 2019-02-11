import angular from 'angular';
import _ from 'lodash';

import { QueryCtrl } from 'app/plugins/sdk';

import { PromQuery } from './types';

class PrometheusQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  metric: any;
  resolutions: any;
  formats: any;
  instant: any;
  oldTarget: any;
  suggestMetrics: any;
  getMetricsAutocomplete: any;
  linkToPrometheus: any;

  /** @ngInject */
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    const target = this.target;
    target.expr = target.expr || '';
    target.intervalFactor = target.intervalFactor || 1;
    target.format = target.format || this.getDefaultFormat();

    this.metric = '';
    this.resolutions = _.map([1, 2, 3, 4, 5, 10], f => {
      return { factor: f, label: '1/' + f };
    });

    this.formats = [
      { text: 'Time series', value: 'time_series' },
      { text: 'Table', value: 'table' },
      { text: 'Heatmap', value: 'heatmap' },
    ];

    this.instant = false;

    this.updateLink();
  }

  getDefaultFormat() {
    if (this.panelCtrl.panel.type === 'table') {
      return 'table';
    } else if (this.panelCtrl.panel.type === 'heatmap') {
      return 'heatmap';
    }

    return 'time_series';
  }

  onChange = (nextQuery: PromQuery) => {
    console.log('change expression', nextQuery.expr);
    this.target = { ...nextQuery };
  };

  refreshMetricData = () => {
    if (!_.isEqual(this.oldTarget, this.target)) {
      this.oldTarget = angular.copy(this.target);
      this.panelCtrl.refresh();
      this.updateLink();
    }
  };

  updateLink() {
    const range = this.panelCtrl.range;
    if (!range) {
      return;
    }

    const rangeDiff = Math.ceil((range.to.valueOf() - range.from.valueOf()) / 1000);
    const endTime = range.to.utc().format('YYYY-MM-DD HH:mm');
    const expr = {
      'g0.expr': this.templateSrv.replace(
        this.target.expr,
        this.panelCtrl.panel.scopedVars,
        this.datasource.interpolateQueryExpr
      ),
      'g0.range_input': rangeDiff + 's',
      'g0.end_input': endTime,
      'g0.step_input': this.target.step,
      'g0.stacked': this.panelCtrl.panel.stack ? 1 : 0,
      'g0.tab': 0,
    };
    const args = _.map(expr, (v, k) => {
      return k + '=' + encodeURIComponent(v);
    }).join('&');
    this.linkToPrometheus = this.datasource.directUrl + '/graph?' + args;
  }

  getCollapsedText() {
    return this.target.expr;
  }
}

export { PrometheusQueryCtrl };
