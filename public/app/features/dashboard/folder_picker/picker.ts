///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class FolderPickerCtrl {
  dashboard: any;
  folders: Folder[];
  selectedFolder: number;

  /** @ngInject */
  constructor(private backendSrv, private $scope, $sce) {
    this.get(this.dashboard.id);
    this.selectedFolder = this.dashboard.meta.parentId;
    this.folders = [{id: 0, title: 'Root', type: 'dash-folder'}];
  }

  get(dashboardId: number) {
    var params = {
      type: 'dash-folder',
    };

    return this.backendSrv.search(params).then(result => {
      this.folders.push(...result);
    });
  }

  folderChanged() {
    this.dashboard.parentId = this.selectedFolder;
  }
}

export interface Folder {
  id: number;
  title: string;
  uri?: string;
  type: string;
  tags?: string[];
  isStarred?: boolean;
  parentId?: number;
  dashboards?: any;
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
