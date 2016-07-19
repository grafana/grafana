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

var reducerAvgDef = new QueryPartDef({
  type: 'avg',
  params: [],
  defaultParams: []
});

export class AlertTabCtrl {
  panel: any;
  panelCtrl: any;
  metricTargets;
  handlers = [{text: 'Grafana', value: 1}, {text: 'External', value: 0}];
  conditionTypes = [
    {text: 'Query', value: 'query'},
    {text: 'Other alert', value: 'other_alert'},
    {text: 'Time of day', value: 'time_of_day'},
    {text: 'Day of week', value: 'day_of_week'},
  ];
  alert: any;
  conditionModels: any;
  levelOpList = [
    {text: '>', value: '>'},
    {text: '<', value: '<'},
    {text: '=', value: '='},
  ];

  /** @ngInject */
  constructor($scope, private $timeout) {
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    $scope.ctrl = this;

    this.metricTargets = this.panel.targets.map(val => val);
    this.initModel();

    // set panel alert edit mode
    $scope.$on("$destroy", () => {
      this.panelCtrl.editingAlert = false;
      this.panelCtrl.render();
    });
  }

  getThresholdWithDefaults(threshold) {
    threshold = threshold || {};
    threshold.op = threshold.op || '>';
    threshold.value = threshold.value || undefined;
    return threshold;
  }

  initModel() {
    var alert = this.alert = this.panel.alert = this.panel.alert || {};

    alert.conditions = alert.conditions || [];
    if (alert.conditions.length === 0) {
      alert.conditions.push(this.buildDefaultCondition());
    }

    alert.frequency = alert.frequency || '60s';
    alert.handler = alert.handler || 1;
    alert.notifications = alert.notifications || [];

    var defaultName = this.panel.title + ' alert';
    alert.name = alert.name || defaultName;
    alert.description = alert.description || defaultName;

    this.conditionModels = _.reduce(alert.conditions, (memo, value) => {
      memo.push(this.buildConditionModel(value));
      return memo;
    }, []);

    this.panelCtrl.editingAlert = true;
    this.panelCtrl.render();
  }

  buildDefaultCondition() {
    return {
      type: 'query',
      refId: 'A',
      from: '5m',
      to: 'now',
      reducer: 'avg',
      reducerParams: [],
      warn: this.getThresholdWithDefaults({}),
      crit: this.getThresholdWithDefaults({}),
    };
  }

  buildConditionModel(source) {
    var cm: any = {source: source, type: source.type};

    var queryPartModel = {
      params: [source.refId, source.from, source.to]
    };

    cm.queryPart = new QueryPart(queryPartModel, alertQueryDef);
    cm.reducerPart = new QueryPart({params: []}, reducerAvgDef);
    return cm;
  }

  queryPartUpdated(conditionModel) {
    conditionModel.source.refId = conditionModel.queryPart.params[0];
    conditionModel.source.from = conditionModel.queryPart.params[1];
    conditionModel.source.to = conditionModel.queryPart.params[2];
  }

  addCondition(type) {
    var condition = this.buildDefaultCondition();
    // add to persited model
    this.alert.conditions.push(condition);
    // add to view model
    this.conditionModels.push(this.buildConditionModel(condition));
  }

  removeCondition(index) {
    this.alert.conditions.splice(index, 1);
    this.conditionModels.splice(index, 1);
  }

  delete() {
    this.alert.enabled = false;
    this.alert.warn.value = undefined;
    this.alert.crit.value = undefined;

    // reset model but keep thresholds instance
    this.initModel();
  }

  enable() {
    this.alert.enabled = true;
    this.initModel();
  }

  thresholdsUpdated() {
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
