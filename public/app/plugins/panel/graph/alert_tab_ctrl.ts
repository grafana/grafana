 ///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import angular from 'angular';

import {
  QueryPartDef,
  QueryPart,
} from 'app/core/components/query_part/query_part';

var alertQueryDef = new QueryPartDef({
  type: 'query',
  params: [
    {name: "queryRefId", type: 'string', options: ['#A', '#B', '#C', '#D']},
    {name: "from", type: "string", options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h']},
    {name: "to", type: "string", options: ['now']},
  ],
  defaultParams: ['#A', '5m', 'now', 'avg']
});

export class AlertTabCtrl {
  panel: any;
  panelCtrl: any;
  alerting: any;
  metricTargets = [{ refId: '- select query -' } ];
  transforms = [
    {
      text: 'Aggregation',
      type: 'aggregation',
    },
    {
      text: 'Linear Forecast',
      type: 'forecast',
    },
    {
      text: 'Percent Change',
      type: 'percent_change',
    },
    {
      text: 'Query diff',
      type: 'query_diff',
    },
  ];
  aggregators = ['avg', 'sum', 'min', 'max', 'last'];
  rule: any;
  query: any;
  queryParams: any;
  transformDef: any;
  trasnformQuery: any;

  defaultValues = {
    frequency: 10,
    warning: { op: '>', level: undefined },
    critical: { op: '>', level: undefined },
    query: {
      refId: 'A',
      from: '5m',
      to: 'now',
    },
    transform: {
      type: 'aggregation',
      method: 'avg'
    }
  };

  /** @ngInject */
  constructor($scope, private $timeout) {
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    $scope.ctrl = this;

    this.metricTargets = this.panel.targets.map(val => val);
    this.rule = this.panel.alerting = this.panel.alerting || {};

    // set defaults
    _.defaults(this.rule, this.defaultValues);

    var defaultName = (this.panelCtrl.dashboard.title + ' ' + this.panel.title + ' alert');
    this.rule.name = this.rule.name || defaultName;
    this.rule.description = this.rule.description || defaultName;
    this.rule.queryRef = this.panel.alerting.queryRef || this.metricTargets[0].refId;

    // great temp working model
    this.queryParams = {
      params: [
        this.rule.query.refId,
        this.rule.query.from,
        this.rule.query.to
      ]
    };

    // init the query part components model
    this.query = new QueryPart(this.queryParams, alertQueryDef);
    this.convertThresholdsToAlertThresholds();
    this.transformDef = _.findWhere(this.transforms, {type: this.rule.transform.type});
  }

  queryUpdated() {
    this.rule.query = {
      refId: this.query.params[0],
      from: this.query.params[1],
      to: this.query.params[2],
    };
  }

  transformChanged() {
    // clear model
    this.rule.transform = {type: this.rule.transform.type};
    this.transformDef = _.findWhere(this.transforms, {type: this.rule.transform.type});

    switch (this.rule.transform.type) {
      case 'aggregation':  {
        this.rule.transform.method = 'avg';
        break;
      }
      case "forecast": {
        this.rule.transform.timespan = '7d';
        break;
      }
    }
  }

  convertThresholdsToAlertThresholds() {
    if (this.panel.grid
        && this.panel.grid.threshold1
        && this.rule.warnLevel === undefined
       ) {
      this.rule.warning.op = '>';
      this.rule.warning.level = this.panel.grid.threshold1;
    }

    if (this.panel.grid
        && this.panel.grid.threshold2
        && this.rule.critical.level === undefined
       ) {
      this.rule.critical.op = '>';
      this.rule.critical.level = this.panel.grid.threshold2;
    }
  }

  markAsDeleted() {
    this.panel.alerting = this.defaultValues;
  }

  thresholdsUpdated() {
    if (this.panel.alerting.warnLevel) {
      this.panel.grid.threshold1 = parseInt(this.panel.alerting.warnLevel);
    }

    if (this.panel.alerting.critLevel) {
      this.panel.grid.threshold2 = parseInt(this.panel.alerting.critLevel);
    }

    this.panelCtrl.render();
  }
}

/** @ngInject */
export function graphAlertEditor() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/plugins/panel/graph/partials/tab_alerting.html',
    controller: AlertTabCtrl,
  };
}
