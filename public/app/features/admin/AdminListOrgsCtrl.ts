import { backendSrv } from 'app/core/services/backend_srv';
import { NavModelSrv } from 'app/core/core';
import { Scope, CoreEvents, AppEventEmitter } from 'app/types';

export default class AdminListOrgsCtrl {
  /** @ngInject */
  constructor($scope: Scope & AppEventEmitter, navModelSrv: NavModelSrv) {
    $scope.init = async () => {
      $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);
      await $scope.getOrgs();
    };

    $scope.getOrgs = async () => {
      const orgs = await backendSrv.get('/api/orgs');
      $scope.orgs = orgs;
    };

    $scope.deleteOrg = (org: any) => {
      $scope.appEvent(CoreEvents.showConfirmModal, {
        title: 'Delete',
        text: `Do you want to delete organization ${org.name}?`,
        text2: 'All dashboards for this organization will be removed!',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: () => {
          backendSrv.delete('/api/orgs/' + org.id).then(() => {
            $scope.getOrgs();
          });
        },
      });
    };

    $scope.init();
  }
}
