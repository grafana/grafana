///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import {DashboardModel} from '../dashboard/model';

export class MetricsTabCtrl {
  dsName: string;
  panel: any;
  panelCtrl: any;
  datasources: any[];
  current: any;
  nextRefId: string;
  dashboard: DashboardModel;
  panelDsValue: any;
  addQueryDropdown: any;

  /** @ngInject */
  constructor($scope, private uiSegmentSrv, private datasourceSrv) {
    this.panelCtrl = $scope.ctrl;
    $scope.ctrl = this;

    this.panel = this.panelCtrl.panel;
    this.dashboard = this.panelCtrl.dashboard;
    this.datasources = datasourceSrv.getMetricSources();
    this.panelDsValue = this.panelCtrl.panel.datasource || null;

    for (let ds of this.datasources) {
      if (ds.value === this.panelDsValue) {
        this.current = ds;
      }
    }

    this.addQueryDropdown = {text: 'Add Query', value: null, fake: true};
    // update next ref id
    this.panelCtrl.nextRefId = this.dashboard.getNextQueryLetter(this.panel);
  }

  getOptions(includeBuiltin) {
    return Promise.resolve(this.datasources.filter(value => {
      return includeBuiltin || !value.meta.builtIn;
    }).map(ds => {
      return {value: ds.value, text: ds.name, datasource: ds};
    }));
  }

  datasourceChanged(option) {
    if (!option) {
      return;
    }

    this.current = option.datasource;
    this.panelCtrl.setDatasource(option.datasource);
  }

  addMixedQuery(option) {
    if (!option) {
      return;
    }

    var target: any = {isNew: true};
    this.panelCtrl.addQuery({isNew: true, datasource: option.datasource.name});
    this.addQueryDropdown = {text: 'Add Query', value: null, fake: true};
  }

  addQuery() {
    this.panelCtrl.addQuery({isNew: true});
  }
}

/** @ngInject **/
export function metricsTabDirective() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/features/panel/partials/metrics_tab.html',
    controller: MetricsTabCtrl,
  };
}

