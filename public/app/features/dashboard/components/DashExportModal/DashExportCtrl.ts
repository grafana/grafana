import angular from 'angular';
import { saveAs } from 'file-saver';

import coreModule from 'app/core/core_module';
import { DashboardExporter } from './DashboardExporter';
import { DashboardSrv } from '../../services/DashboardSrv';
import DatasourceSrv from 'app/features/plugins/datasource_srv';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { CoreEvents } from 'app/types';

export class DashExportCtrl {
  dash: any;
  exporter: DashboardExporter;
  dismiss: () => void;
  shareExternally: boolean;

  /** @ngInject */
  constructor(
    private dashboardSrv: DashboardSrv,
    datasourceSrv: DatasourceSrv,
    private $scope: any,
    private $rootScope: GrafanaRootScope
  ) {
    this.exporter = new DashboardExporter(datasourceSrv);

    this.dash = this.dashboardSrv.getCurrent();
  }

  saveDashboardAsFile() {
    if (this.shareExternally) {
      this.exporter.makeExportable(this.dash).then((dashboardJson: any) => {
        this.$scope.$apply(() => {
          this.openSaveAsDialog(dashboardJson);
        });
      });
    } else {
      this.openSaveAsDialog(this.dash.getSaveModelClone());
    }
  }

  viewJson() {
    if (this.shareExternally) {
      this.exporter.makeExportable(this.dash).then((dashboardJson: any) => {
        this.$scope.$apply(() => {
          this.openJsonModal(dashboardJson);
        });
      });
    } else {
      this.openJsonModal(this.dash.getSaveModelClone());
    }
  }

  private openSaveAsDialog(dash: any) {
    const blob = new Blob([angular.toJson(dash, true)], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, dash.title + '-' + new Date().getTime() + '.json');
  }

  private openJsonModal(clone: object) {
    const model = {
      object: clone,
      enableCopy: true,
    };

    this.$rootScope.appEvent(CoreEvents.showModal, {
      src: 'public/app/partials/edit_json.html',
      model: model,
    });

    this.dismiss();
  }
}

export function dashExportDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/components/DashExportModal/template.html',
    controller: DashExportCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: { dismiss: '&' },
  };
}

coreModule.directive('dashExportModal', dashExportDirective);
