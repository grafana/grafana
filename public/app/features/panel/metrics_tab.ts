///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import {DashboardModel} from '../dashboard/model';

export class MetricsTabCtrl {
  dsSegment: any;
  mixedDsSegment: any;
  dsName: string;
  panel: any;
  panelCtrl: any;
  datasources: any[];
  current: any;
  nextRefId: string;
  dashboard: DashboardModel;

  /** @ngInject */
  constructor($scope, private uiSegmentSrv, datasourceSrv) {
    this.panelCtrl = $scope.ctrl;
    $scope.ctrl = this;

    this.panel = this.panelCtrl.panel;
    this.dashboard = this.panelCtrl.dashboard;
    this.datasources = datasourceSrv.getMetricSources();

    var dsValue = this.panelCtrl.panel.datasource || null;

    for (let ds of this.datasources) {
      if (ds.value === dsValue) {
        this.current = ds;
      }
    }

    if (!this.current) {
      this.current = {name: dsValue + ' not found', value: null};
    }

    this.dsSegment = uiSegmentSrv.newSegment({value: this.current.name, selectMode: true});
    this.mixedDsSegment = uiSegmentSrv.newSegment({value: 'Add Query', selectMode: true});
    this.nextRefId = this.getNextQueryLetter();
  }

  getOptions(includeBuiltin) {
    return Promise.resolve(this.datasources.filter(value => {
      return includeBuiltin || !value.meta.builtIn;
    }).map(value => {
      return this.uiSegmentSrv.newSegment(value.name);
    }));
  }

  datasourceChanged() {
    var ds = _.find(this.datasources, {name: this.dsSegment.value});
    if (ds) {
      this.current = ds;
      this.panelCtrl.setDatasource(ds);
    }
  }

  mixedDatasourceChanged() {
    var target: any = {isNew: true};
    var ds = _.find(this.datasources, {name: this.mixedDsSegment.value});
    if (ds) {
      target.datasource = ds.name;
      this.panelCtrl.panel.targets.push(target);
      this.mixedDsSegment.value = '';
    }
  }

  getNextQueryLetter() {
    return this.dashboard.getNextQueryLetter(this.panel);
  }

  addDataQuery() {
    var target: any = {
      isNew: true,
      refId: this.getNextQueryLetter()
    };
    this.panelCtrl.panel.targets.push(target);
    this.nextRefId = this.getNextQueryLetter();
  }
}

/** @ngInject **/
export function metricsTabDirective() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/partials/metrics.html',
    controller: MetricsTabCtrl,
  };
}
