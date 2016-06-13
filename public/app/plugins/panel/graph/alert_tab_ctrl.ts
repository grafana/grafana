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
  metricTargets = [{ refId: '- select query -' } ];
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
  query: any;
  queryParams: any;
  transformDef: any;
  levelOpList = [
    {text: '>', value: '>'},
    {text: '<', value: '<'},
    {text: '=', value: '='},
  ];

  defaultValues = {
    frequency: '60s',
    notify: [],
    enabled: false,
    handler: 1,
    warn: { op: '>', level: undefined },
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
    this.initAlertModel();

    // set panel alert edit mode
    $scope.$on("$destroy", () => {
      this.panelCtrl.editingAlert = false;
      this.panelCtrl.render();
    });
  }

  initAlertModel() {
    if (!this.panel.alert) {
      return;
    }

    this.alert = this.panel.alert;

    // set defaults
    _.defaults(this.alert, this.defaultValues);

    var defaultName = (this.panelCtrl.dashboard.title + ' ' + this.panel.title + ' alert');
    this.alert.name = this.alert.name || defaultName;
    this.alert.description = this.alert.description || defaultName;

    // great temp working model
    this.queryParams = {
      params: [
        this.alert.query.refId,
        this.alert.query.from,
        this.alert.query.to
      ]
    };

    // init the query part components model
    this.query = new QueryPart(this.queryParams, alertQueryDef);
    this.transformDef = _.findWhere(this.transforms, {type: this.alert.transform.type});

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

  operatorChanged() {
    this.panelCtrl.render();
  }

  delete() {
    delete this.panel.alert;
    this.panelCtrl.editingAlert = false;
    this.panelCtrl.render();
  }

  enable() {
    this.panel.alert = {};
    this.initAlertModel();
  }

  levelsUpdated() {
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
