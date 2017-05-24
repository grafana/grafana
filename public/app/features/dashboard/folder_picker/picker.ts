///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class FolderPickerCtrl {
  dashboard: any;
  folders: any[];
  selectedFolder: number;

  /** @ngInject */
  constructor(private backendSrv, private $scope, $sce) {
    this.get(this.dashboard.id);
    this.selectedFolder = this.dashboard.meta.parentId;
  }

  get(dashboardId: number) {
    var params = {
      type: 'dash-folder',
    };

    return this.backendSrv.search(params).then(result => {
      this.folders = result;
    });
  }

  folderChanged() {
    if (this.selectedFolder > 0) {
      this.dashboard.parentId = this.selectedFolder;
    }
  }
}

export function folderPicker() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/folder_picker/picker.html',
    controller: FolderPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: { dashboard: "=" }
  };
}

coreModule.directive('folderPicker', folderPicker);
