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
  metricTargets;
  handlers = [{text: 'Grafana', value: 1}, {text: 'External', value: 0}];
  transforms = [
    {
      text: 'Aggregation',
      type: 'aggregation',
    },
    {
      text: 'Linear Forecast',
      type: 'forecast',
    },
  ];
  aggregators = ['avg', 'sum', 'min', 'max', 'last'];
  alert: any;
  thresholds: any;
  query: any;
  queryParams: any;
  transformDef: any;
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

    // set threshold defaults
    alert.warn = this.getThresholdWithDefaults(alert.warn);
    alert.crit = this.getThresholdWithDefaults(alert.crit);

    alert.query = alert.query || {};
    alert.query.refId = alert.query.refId || 'A';
    alert.query.from = alert.query.from || '5m';
    alert.query.to = alert.query.to || 'now';

    alert.transform = alert.transform || {};
    alert.transform.type = alert.transform.type || 'aggregation';
    alert.transform.method = alert.transform.method || 'avg';

    alert.frequency = alert.frequency || '60s';
    alert.handler = alert.handler || 1;
    alert.notifications = alert.notifications || [];

    var defaultName = this.panel.title + ' alert';
    alert.name = alert.name || defaultName;
    alert.description = alert.description || defaultName;

    // great temp working model
    this.queryParams = {
      params: [alert.query.refId, alert.query.from, alert.query.to]
    };

    // init the query part components model
    this.query = new QueryPart(this.queryParams, alertQueryDef);
    this.transformDef = _.findWhere(this.transforms, {type: alert.transform.type});

    this.panelCtrl.editingAlert = true;
    this.panelCtrl.render();
  }

  queryUpdated() {
    this.alert.query = {
      refId: this.query.params[0],
      from: this.query.params[1],
      to: this.query.params[2],
    };
  }

  transformChanged() {
    // clear model
    this.alert.transform = {type: this.alert.transform.type};
    this.transformDef = _.findWhere(this.transforms, {type: this.alert.transform.type});

    switch (this.alert.transform.type) {
      case 'aggregation':  {
        this.alert.transform.method = 'avg';
        break;
      }
      case "forecast": {
        this.alert.transform.timespan = '7d';
        break;
      }
    }
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
