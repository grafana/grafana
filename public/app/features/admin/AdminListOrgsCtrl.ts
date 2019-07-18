import { BackendSrv } from 'app/core/services/backend_srv';
import { NavModelSrv } from 'app/core/core';

export default class AdminListOrgsCtrl {
  /** @ngInject */
  constructor($scope: any, backendSrv: BackendSrv, navModelSrv: NavModelSrv) {
    $scope.init = () => {
      $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);
      $scope.getOrgs();
    };

    $scope.getOrgs = () => {
      backendSrv.get('/api/orgs').then((orgs: any) => {
        $scope.orgs = orgs;
      });
    };

    $scope.deleteOrg = (org: any) => {
      $scope.appEvent('confirm-modal', {
        title: 'Delete',
        text: 'Do you want to delete organization ' + org.name + '?',
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
