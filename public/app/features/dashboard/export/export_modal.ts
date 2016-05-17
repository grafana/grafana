///<reference path="../../../headers/common.d.ts" />

import kbn from 'app/core/utils/kbn';
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
