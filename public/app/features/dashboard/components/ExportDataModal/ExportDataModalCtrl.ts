import angular from 'angular';
import * as fileExport from 'app/core/utils/file_export';
import appEvents from 'app/core/app_events';
import { DashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { CoreEvents } from 'app/types';

export class ExportDataModalCtrl {
  private data: any;
  private panel: string;
  asRows = true;
  dateTimeFormat = 'YYYY-MM-DDTHH:mm:ssZ';
  excel = false;

  /** @ngInject */
  constructor(private dashboardSrv: DashboardSrv) {}

  export() {
    const timezone = this.dashboardSrv.getCurrent().timezone;
    const options = {
      excel: this.excel,
      dateTimeFormat: this.dateTimeFormat,
      timezone,
    };
    if (this.panel === 'table') {
      fileExport.exportTableDataToCsv(this.data, this.excel);
    } else {
      if (this.asRows) {
        fileExport.exportSeriesListToCsv(this.data, options);
      } else {
        fileExport.exportSeriesListToCsvColumns(this.data, options);
      }
    }

    this.dismiss();
  }

  dismiss() {
    appEvents.emit(CoreEvents.hideModal);
  }
}

export function exportDataModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/components/ExportDataModal/template.html',
    controller: ExportDataModalCtrl,
    controllerAs: 'ctrl',
    scope: {
      panel: '<',
      data: '<', // The difference to '=' is that the bound properties are not watched
    },
    bindToController: true,
  };
}

angular.module('grafana.directives').directive('exportDataModal', exportDataModal);
