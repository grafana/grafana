import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export class FolderCtrl {
  title: string;
  dismiss: any;

  /** @ngInject */
  constructor(private backendSrv, private $location) {
  }

  create() {
    if (!this.title || this.title.trim().length === 0) {
      return;
    }

    const title = this.title.trim();

    return this.backendSrv.createDashboardFolder(title).then(result => {
      appEvents.emit('alert-success', ['Folder Created', 'OK']);
      this.dismiss();

      var folderUrl = '/dashboard/db/' + result.slug;
      this.$location.url(folderUrl);
    });
  }
}

export function folderModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/folder_modal/folder.html',
    controller: FolderCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dismiss: "&"
    }
  };
}

coreModule.directive('folderModal', folderModal);
