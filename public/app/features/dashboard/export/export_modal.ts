///<reference path="../../../headers/common.d.ts" />

import kbn from 'app/core/utils/kbn';
import angular from 'angular';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import _ from 'lodash';

import {DashboardExporter} from './exporter';

export class DashExportCtrl {
  dash: any;
  exporter: DashboardExporter;

  /** @ngInject */
  constructor(private backendSrv, dashboardSrv, datasourceSrv, $scope) {
    this.exporter = new DashboardExporter(datasourceSrv);

    var current = dashboardSrv.getCurrent().getSaveModelClone();

    this.exporter.makeExportable(current).then(dash => {
      $scope.$apply(() => {
        this.dash = dash;
      });
    });
  }

  save() {
    var blob = new Blob([angular.toJson(this.dash, true)], { type: "application/json;charset=utf-8" });
    var wnd: any = window;
    wnd.saveAs(blob, this.dash.title + '-' + new Date().getTime() + '.json');
  }

  saveJson() {
    var html = angular.toJson(this.dash, true);
    var uri = "data:application/json," + encodeURIComponent(html);
    var newWindow = window.open(uri);
  }

}

export function dashExportDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/export/export_modal.html',
    controller: DashExportCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
  };
}

coreModule.directive('dashExportModal', dashExportDirective);
