///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import {PanelCtrl} from 'app/plugins/sdk';

class PermissionListCtrl extends PanelCtrl {
  static templateUrl = 'module.html';

  userPermissions: any[];
  userGroupPermissions: any[];
  roles: any[];

  panelDefaults = {
    folderId: 0
  };

  /** @ngInject */
  constructor($scope, $injector, private backendSrv) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    this.events.on('refresh', this.onRefresh.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));

    this.getPermissions();
  }

  onInitEditMode() {
    this.editorTabIndex = 1;
    this.addEditorTab('Options', 'public/app/plugins/panel/permissionlist/editor.html');
  }

  onRefresh() {
    var promises = [];

    promises.push(this.getPermissions());

    return Promise.all(promises)
      .then(this.renderingCompleted.bind(this));
  }

  onFolderChange(folder: any) {
    this.panel.folderId = folder.id;
    this.refresh();
  }

  getPermissions() {
  return this.backendSrv.get(`/api/dashboards/id/${this.panel.folderId}/acl`)
    .then(result => {
      this.userPermissions = _.filter(result, p => { return p.userId > 0;});
      this.userGroupPermissions = _.filter(result, p => { return p.userGroupId > 0;});
      // this.roles = this.setRoles(result);
    });
  }

}

export {PermissionListCtrl, PermissionListCtrl as PanelCtrl};
