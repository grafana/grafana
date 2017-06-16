///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class FolderPickerCtrl {
  folders: Folder[];
  selectedFolder: number;
  selectedFolderSegment: any;
  onChange: any;
  rootFolderName: string;

  /** @ngInject */
  constructor(private backendSrv, private $scope, private $sce, private uiSegmentSrv) {
    this.selectedFolderSegment = this.uiSegmentSrv.newSegment({value: this.rootFolderName || 'Root', selectMode: true});
    this.get();
  }

  get() {
    var params = {
      type: 'dash-folder',
    };

    return this.backendSrv.search(params).then(result => {
      this.folders = [{id: 0, title: this.rootFolderName || 'Root', type: 'dash-folder'}];
      this.folders.push(...result);

      if (this.selectedFolder) {
        const selected = _.find(this.folders, {id: this.selectedFolder});

        this.selectedFolderSegment.value = selected.title;
        this.selectedFolderSegment.text = selected.title;
        this.selectedFolderSegment.html = this.$sce.trustAsHtml(selected.title);
      }
    });
  }

  getOptions() {
    return Promise.resolve(this.folders.map(folder => {
      return this.uiSegmentSrv.newSegment(folder.title);
    }));
  }

  folderChanged() {
    const selected = _.find(this.folders, {title: this.selectedFolderSegment.value});
    if (selected) {
      this.onChange({$folderId: selected.id});
    }
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
    scope: {
      selectedFolder: "<",
      onChange: "&",
      rootFolderName: "@"
    }
  };
}

coreModule.directive('folderPicker', folderPicker);
