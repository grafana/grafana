import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { DashboardModel } from '../dashboard_model';

export class MoveToFolderCtrl {
  dashboards: any;
  folder: any;
  dismiss: any;
  afterSave: any;

  /** @ngInject */
  constructor(private backendSrv, private $q) { }

  onFolderChange(folder) {
    this.folder = folder;
  }

  private doNext(fn, ...args: any[]) {
    return function (result) {
      return fn.apply(null, args)
        .then(res => {
          return Array.prototype.concat(result, [res]);
        });
    };
  }

  private doInOrder(tasks, init) {
    return tasks.reduce(this.$q.when, init);
  }

  private moveDashboard(dash) {
    let deferred = this.$q.defer();

    this.backendSrv.get('/api/dashboards/db/' + dash)
      .then(fullDash => {
        const model = new DashboardModel(fullDash.dashboard, fullDash.meta);

        if ((!model.folderId && this.folder.id === 0) ||
          model.folderId === this.folder.id) {
          deferred.resolve({alreadyInFolder: true});
          return;
        }

        model.folderId = this.folder.id;
        model.meta.folderId = this.folder.id;
        model.meta.folderTitle = this.folder.title;
        const clone = model.getSaveModelClone();

        this.backendSrv.saveDashboard(clone)
          .then(() => {
            deferred.resolve({succeeded: true});
          })
          .catch(err => {
            deferred.resolve({succeeded: false});
          });
      });

    return deferred.promise;
  }

  save() {
    const tasks = [];

    for (let dash of this.dashboards) {
      tasks.push(this.doNext(this.moveDashboard.bind(this), dash));
    }

    return this.doInOrder(tasks, [])
      .then(result => {
        const totalCount = result.length;
        const successCount = _.filter(result, { succeeded: true }).length;
        const alreadyInFolderCount = _.filter(result, { alreadyInFolder: true }).length;

        if (successCount > 0) {
          const msg = successCount + ' dashboard' + (successCount === 1 ? '' : 's') + ' moved to ' + this.folder.title;
          appEvents.emit('alert-success', [ 'Dashboard' + (successCount === 1 ? '' : 's') + ' Moved', msg]);
        }

        if (totalCount === alreadyInFolderCount) {
          appEvents.emit('alert-error', ['Error', 'Dashboards already belongs to folder ' + this.folder.title]);
        }

        this.dismiss();
        return this.afterSave();
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
      afterSave: "&"
    }
  };
}

coreModule.directive('moveToFolderModal', moveToFolderModal);
