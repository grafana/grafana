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
  dismiss: () => void;

  /** @ngInject */
  constructor(private backendSrv, private dashboardSrv, datasourceSrv, private $scope) {
    this.exporter = new DashboardExporter(datasourceSrv);

    this.exporter.makeExportable(this.dashboardSrv.getCurrent()).then(dash => {
      this.$scope.$apply(() => {
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
    var clone = this.dashboardSrv.getCurrent().getSaveModelClone();

    this.$scope.$root.appEvent('show-json-editor', {
      object: clone,
    });
    this.dismiss();
  }
}

export function dashExportDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/export/export_modal.html',
    controller: DashExportCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {dismiss: "&"}
  };
}

coreModule.directive('dashExportModal', dashExportDirective);
