///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class FolderCtrl {
  title: string;

  /** @ngInject */
  constructor(private backendSrv, private $scope, $sce) {
  }

  create() {
    if (!this.title || this.title.trim().length === 0) {
      return;
    }

    const title = this.title.trim();


    return this.backendSrv.saveDashboardFolder(title).then((result) => {
      appEvents.emit('alert-success', ['Dashboard saved', 'Saved as ' + title]);

      appEvents.emit('dashboard-saved', result);
      this.dismiss();
    });
  }

  dismiss() {
    appEvents.emit('hide-modal');
  }
}

export function folderModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/folder_modal/folder.html',
    controller: FolderCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
  };
}

coreModule.directive('folderModal', folderModal);
