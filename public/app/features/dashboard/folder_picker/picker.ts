///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class FolderPickerCtrl {
  dashboard: any;
  folders: Folder[];
  selectedFolder: number;
  selectedFolderSegment: any;

  /** @ngInject */
  constructor(private backendSrv, private $scope, private $sce, private uiSegmentSrv) {
    this.selectedFolderSegment = this.uiSegmentSrv.newSegment({value: 'Root', selectMode: true});

    this.selectedFolder = this.dashboard.meta.parentId;
    this.get(this.dashboard.id);
  }

  get(dashboardId: number) {
    var params = {
      type: 'dash-folder',
    };

    return this.backendSrv.search(params).then(result => {
      this.folders = [{id: 0, title: 'Root', type: 'dash-folder'}];
      this.folders.push(...result);
      const selected = _.find(this.folders, {id: this.selectedFolder});

      this.selectedFolderSegment.value = selected.title;
      this.selectedFolderSegment.text = selected.title;
      this.selectedFolderSegment.html = this.$sce.trustAsHtml(selected.title);
    });
  }

  getOptions() {
    return Promise.resolve(this.folders.map(folder => {
      return this.uiSegmentSrv.newSegment(folder.title);
    }));
  }

  folderChanged() {
    const selected = _.find(this.folders, {title: this.selectedFolderSegment.value});
    this.dashboard.parentId = selected.id;
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
