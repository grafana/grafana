///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import * as fileExport from 'app/core/utils/file_export';
import appEvents from 'app/core/app_events';

export class ExportDataModalCtrl {
  private data: any[];
  asRows: Boolean = true;
  dateTimeFormat: String = 'YYYY-MM-DDTHH:mm:ssZ';
  /** @ngInject */
  constructor(private $scope) { }

  export() {
    if (this.asRows) {
      fileExport.exportSeriesListToCsv(this.data, this.dateTimeFormat);
    } else {
      fileExport.exportSeriesListToCsvColumns(this.data, this.dateTimeFormat);
    }
    this.dismiss();
  }

  dismiss() {
    appEvents.emit('hide-modal');
  }
}

export function exportDataModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/export_data/export_data_modal.html',
    controller: ExportDataModalCtrl,
    controllerAs: 'ctrl',
    scope: {
      data: '<' // The difference to '=' is that the bound properties are not watched
    },
    bindToController: true
  };
}

angular.module('grafana.directives').directive('exportDataModal', exportDataModal);
