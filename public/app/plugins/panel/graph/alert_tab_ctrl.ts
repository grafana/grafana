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
    {name: "aggregation", type: "select", options: ['sum', 'avg', 'min', 'max', 'last']},
  ],
  defaultParams: ['#A', '5m', 'now', 'avg']
});

export class AlertTabCtrl {
  panel: any;
  panelCtrl: any;
  alerting: any;
  metricTargets = [{ refId: '- select query -' } ];
  evalFuncs = [
    {
      text: 'Static Threshold',
      value: 'static',
    },
    {
      text: 'Percent Change Compared To',
      value: 'percent_change',
      secondParam: "query",
    },
    {
      text: 'Forcast',
      value: 'forcast',
      secondParam: "duration",
    }
  ];
  aggregators = ['avg', 'sum', 'min', 'max', 'median'];
  rule: any;
  valueQuery: any;
  evalQuery: any;
  secondParam: any;

  defaultValues = {
    frequency: 10,
    warnOperator: '>',
    critOperator: '>',
    evalFunc: 'static',
    critLevel: 20,
    warnLevel: 10,
    valueQuery: {
      queryRefId: 'A',
      from: '5m',
      to: 'now',
      agg: 'avg',
    },
    evalQuery: {
      queryRefId: 'A',
      from: '5m',
      to: 'now',
      agg: 'avg',
    },
    evalStringParam1: '',
  };

  /** @ngInject */
  constructor($scope, private $timeout) {
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    $scope.ctrl = this;

    _.defaults(this.panel.alerting, this.defaultValues);
    this.rule = this.panel.alerting;

    this.valueQuery = new QueryPart(this.rule.valueQuery, alertQueryDef);
    this.evalQuery = new QueryPart(this.rule.evalQuery, alertQueryDef);

    var defaultName = (this.panelCtrl.dashboard.title + ' ' + this.panel.title + ' alert');
    this.panel.alerting.name = this.panel.alerting.name || defaultName;

    this.panel.targets.map(target => {
      this.metricTargets.push(target);
    });

    this.panel.alerting.queryRef = this.panel.alerting.queryRef || this.metricTargets[0].refId;
    this.convertThresholdsToAlertThresholds();
    this.evalFuncChanged();
  }

  evalFuncChanged() {
    var evalFuncDef = _.findWhere(this.evalFuncs, {value: this.rule.evalFunc});
    this.secondParam = evalFuncDef.secondParam;
  }

  convertThresholdsToAlertThresholds() {
    if (this.panel.grid
        && this.panel.grid.threshold1
        && this.panel.alerting.warnLevel === undefined
       ) {
      this.panel.alerting.warnOperator = '>';
      this.panel.alerting.warnLevel = this.panel.grid.threshold1;
    }

    if (this.panel.grid
        && this.panel.grid.threshold2
        && this.panel.alerting.critLevel === undefined
       ) {
      this.panel.alerting.critOperator = '>';
      this.panel.alerting.critLevel = this.panel.grid.threshold2;
    }
  }

  markAsDeleted() {
    if (this.panel.alerting) {
      this.panel.alerting = this.defaultValues;
    }
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
