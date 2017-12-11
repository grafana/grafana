import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import {DashboardModel} from '../dashboard_model';

export class MoveToFolderCtrl {
  dashboards: any;
  folder: any;
  dismiss: any;
  afterSave: any;
  fromFolderId: number;

  /** @ngInject */
  constructor(private backendSrv, private $q) {}

  onFolderChange(folder) {
    this.folder = folder;
  }

  save() {
    if (this.folder.id === this.fromFolderId) {
      appEvents.emit('alert-error', ['Dashboard(s) already belong to this folder']);
      return;
    }

    const promises = [];
    for (let dash of this.dashboards) {
      const promise = this.backendSrv.get('/api/dashboards/' + dash).then(fullDash => {
        const model = new DashboardModel(fullDash.dashboard, fullDash.meta);

        model.folderId = this.folder.id;
        model.meta.folderId = this.folder.id;
        model.meta.folderTitle = this.folder.title;
        const clone = model.getSaveModelClone();
        return this.backendSrv.saveDashboard(clone);
      });

      promises.push(promise);
    }

    return this.$q.all(promises).then(() => {
      appEvents.emit('alert-success', ['Dashboards Moved', 'OK']);
      this.dismiss();

      return this.afterSave();
    }).then(() => {
      console.log('afterSave');
    }).catch(err => {
      appEvents.emit('alert-error', [err.message]);
    });
  }
}

export function moveToFolderModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/move_to_folder_modal/move_to_folder.html',
    controller: MoveToFolderCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dismiss: "&",
      dashboards: "=",
      fromFolderId: '<',
      afterSave: "&"
    }
  };
}

coreModule.directive('moveToFolderModal', moveToFolderModal);
