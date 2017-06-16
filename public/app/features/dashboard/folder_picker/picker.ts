///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class FolderPickerCtrl {
  folders: Folder[];
  selectedOption: any;
  initialTitle: string;
  onChange: any;
  labelClass: string;

  /** @ngInject */
  constructor(private backendSrv, private $scope, private $sce) {
    if (!this.labelClass) {
      this.labelClass = "width-7";
    }

    this.selectedOption = {text: this.initialTitle, value: null};
  }

  getOptions(query) {
    var params = {
      query: query,
      type: 'dash-folder',
    };

    return this.backendSrv.search(params).then(result => {
      if (query === "") {
        result.unshift({title: "Root", value: 0});
      }
      return _.map(result, item => {
        return {text: item.title, value: item.id};
      });
    });
  }

  folderChanged(option) {
    this.onChange({$folder: {id: option.value, title: option.text}});
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

const template = `
<div class="gf-form">
  <label class="gf-form-label {{ctrl.labelClass}}">Folder</label>
  <div class="dropdown">
    <gf-form-dropdown model="ctrl.selectedOption"
      get-options="ctrl.getOptions($query)"
      on-change="ctrl.folderChanged($option)">
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
      onChange: "&",
      labelClass: "@",
    }
  };
}

coreModule.directive('folderPicker', folderPicker);
