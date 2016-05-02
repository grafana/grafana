///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import angular from 'angular';

export class AlertTabCtrl {
  panel: any;
  panelCtrl: any;
  alerting: any;

  /** @ngInject */
  constructor($scope) {
    $scope.alertTab = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.alerting = this.alerting || {};


    this.convertThresholdsToAlertThresholds();
  }

  convertThresholdsToAlertThresholds() {
    if (this.panel.grid && this.panel.grid.threshold1) {
      this.panel.alerting.warnLevel = '< ' + this.panel.grid.threshold1;
    }

    if (this.panel.grid && this.panel.grid.threshold2) {
      this.panel.alerting.critLevel = '< ' + this.panel.grid.threshold2;
    }
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
