///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import angular from 'angular';

export class AlertTabCtrl {
  panel: any;
  panelCtrl: any;
  alerting: any;
  metricTargets = [{ refId: '- select query -' } ];
  operators = ['>', '<', '<=', '>='];
  aggregators = ['avg', 'sum', 'min', 'max', 'median'];

  /** @ngInject */
  constructor($scope, private $timeout) {
    $scope.alertTab = this; //HACK ATTACK!
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.panel.alerting = this.panel.alerting || {};
    this.panel.alerting.aggregator = this.panel.alerting.aggregator || 'avg';
    this.panel.alerting.interval = this.panel.alerting.interval || '60s';
    this.panel.alerting.queryRange = this.panel.alerting.queryRange || '10m';
    this.panel.alerting.warnOperator = this.panel.alerting.warnOperator || '>';
    this.panel.alerting.critOperator = this.panel.alerting.critOperator || '>';
    var defaultTitle = (this.panelCtrl.dashboard.title + ' ' + this.panel.title + ' alert');
    this.panel.alerting.title = this.panel.alerting.title || defaultTitle;

    this.panel.targets.map(target => {
      this.metricTargets.push(target);
    });
    this.panel.alerting.queryRef = this.panel.alerting.queryRef || this.metricTargets[0].refId;

    this.convertThresholdsToAlertThresholds();
  }

  convertThresholdsToAlertThresholds() {
    if (this.panel.grid && this.panel.grid.threshold1) {
      this.panel.alerting.warnOperator = '>';
      this.panel.alerting.warnLevel = this.panel.grid.threshold1;
    }

    if (this.panel.grid && this.panel.grid.threshold2) {
      this.panel.alerting.critOperator = '>';
      this.panel.alerting.critLevel = this.panel.grid.threshold2;
    }
  }

  markAsDeleted() {
    if (this.panel.alerting) {
      this.panel.alerting.queryRef = this.metricTargets[0].refId;
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
