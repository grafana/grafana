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
  schedulers = [{text: 'Grafana', value: 1}, {text: 'External', value: 0}];
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
    scheduler: 1,
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
    this.panelCtrl.editingAlert = true;
    this.panelCtrl.render();

    $scope.$on("$destroy", () => {
      this.panelCtrl.editingAlert = false;
      this.panelCtrl.render();
    });
  }

  initAlertModel() {
    this.alert = this.panel.alert = this.panel.alert || {};

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
    this.convertThresholdsToAlertThresholds();
    this.transformDef = _.findWhere(this.transforms, {type: this.alert.transform.type});
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

  convertThresholdsToAlertThresholds() {
    // if (this.panel.grid
    //     && this.panel.grid.threshold1
    //     && this.alert.warnLevel === undefined
    //    ) {
    //   this.alert.warning.op = '>';
    //   this.alert.warning.level = this.panel.grid.threshold1;
    // }
    //
    // if (this.panel.grid
    //     && this.panel.grid.threshold2
    //     && this.alert.critical.level === undefined
    //    ) {
    //   this.alert.critical.op = '>';
    //   this.alert.critical.level = this.panel.grid.threshold2;
    // }
  }

  delete() {
    this.alert = this.panel.alert = {};
    this.alert.deleted = true;
    this.initAlertModel();
  }

  enable() {
    delete this.alert.deleted;
    this.alert.enabled = true;
  }

  disable() {
    this.alert.enabled = false;
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
