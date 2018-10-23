import angular from 'angular';
import { saveAs } from 'file-saver';

import coreModule from 'app/core/core_module';
import { DashboardExporter } from './exporter';

export class DashExportCtrl {
  dash: any;
  exporter: DashboardExporter;
  dismiss: () => void;

  /** @ngInject */
  constructor(private dashboardSrv, datasourceSrv, private $scope, private $rootScope) {
    this.exporter = new DashboardExporter(datasourceSrv);

    this.exporter.makeExportable(this.dashboardSrv.getCurrent()).then(dash => {
      this.$scope.$apply(() => {
        this.dash = dash;
      });
    });
  }

  save() {
    const blob = new Blob([angular.toJson(this.dash, true)], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, this.dash.title + '-' + new Date().getTime() + '.json');
  }

  saveJson() {
    const clone = this.dash;
    const editScope = this.$rootScope.$new();
    editScope.object = clone;
    editScope.enableCopy = true;

    this.$rootScope.appEvent('show-modal', {
      src: 'public/app/partials/edit_json.html',
      scope: editScope,
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
    scope: { dismiss: '&' },
  };
}

coreModule.directive('dashExportModal', dashExportDirective);
