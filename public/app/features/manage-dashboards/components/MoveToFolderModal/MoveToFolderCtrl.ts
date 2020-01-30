import { IScope } from 'angular';
import { AppEvents } from '@grafana/data';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { backendSrv } from 'app/core/services/backend_srv';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

export class MoveToFolderCtrl {
  dashboards: any;
  folder: any;
  dismiss: any;
  afterSave: any;
  isValidFolderSelection = true;

  constructor(private $scope: IScope) {}

  onFolderChange = (folder: any) => {
    this.folder = folder;
    console.log(folder);
  };

  save = () => {
    return promiseToDigest(this.$scope)(
      backendSrv.moveDashboards(this.dashboards, this.folder).then((result: any) => {
        if (result.successCount > 0) {
          const header = `Dashboard${result.successCount === 1 ? '' : 's'} Moved`;
          const msg = `${result.successCount} dashboard${result.successCount === 1 ? '' : 's'} moved to ${
            this.folder.title
          }`;
          appEvents.emit(AppEvents.alertSuccess, [header, msg]);
        }

        if (result.totalCount === result.alreadyInFolderCount) {
          appEvents.emit(AppEvents.alertError, ['Error', `Dashboards already belongs to folder ${this.folder.title}`]);
        }

        this.dismiss();
        return this.afterSave();
      })
    );
  };

  onEnterFolderCreation = () => {
    this.isValidFolderSelection = false;
  };

  onExitFolderCreation = () => {
    this.isValidFolderSelection = true;
  };
}

export function moveToFolderModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/manage-dashboards/components/MoveToFolderModal/template.html',
    controller: MoveToFolderCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dismiss: '&',
      dashboards: '=',
      afterSave: '&',
    },
  };
}

coreModule.directive('moveToFolderModal', moveToFolderModal);
