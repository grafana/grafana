///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import _ from 'lodash';

export class FolderPickerCtrl {
  initialTitle: string;
  initialFolderId: number;
  labelClass: string;
  onChange: any;
  rootName = 'Root';

  private folder: any;

  /** @ngInject */
  constructor(private backendSrv) {
    if (!this.labelClass) {
      this.labelClass = "width-7";
    }

    if (this.initialFolderId > 0) {
      this.getOptions('').then(result => {
        this.folder = _.find(result, {value: this.initialFolderId});
      });
    } else {
      this.folder = {text: this.initialTitle, value: null};
    }
  }

  getOptions(query) {
    var params = {
      query: query,
      type: 'dash-folder',
    };

    return this.backendSrv.search(params).then(result => {
      if (query === "") {
        result.unshift({title: this.rootName, value: 0});
      }

      return _.map(result, item => {
        return {text: item.title, value: item.id};
      });
    });
  }

  onFolderChange(option) {
    this.onChange({$folder: {id: option.value, title: option.text}});
  }

}

const template = `
<div class="gf-form">
  <label class="gf-form-label {{ctrl.labelClass}}">Folder</label>
  <div class="dropdown">
    <gf-form-dropdown model="ctrl.folder"
      get-options="ctrl.getOptions($query)"
      on-change="ctrl.onFolderChange($option)">
    </gf-form-dropdown>
  </div>
</div>
`;

export function folderPicker() {
  return {
    restrict: 'E',
    template: template,
    controller: FolderPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      initialTitle: "<",
      initialFolderId: '<',
      labelClass: '@',
      rootName: '@',
      onChange: '&'
    }
  };
}

coreModule.directive('folderPicker', folderPicker);
