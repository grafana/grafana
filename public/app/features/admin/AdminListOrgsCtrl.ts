export default class AdminListOrgsCtrl {
  /** @ngInject */
  constructor($scope, backendSrv, navModelSrv) {
    $scope.init = () => {
      $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);
      $scope.getOrgs();
    };

    $scope.getOrgs = () => {
      backendSrv.get('/api/orgs').then(orgs => {
        $scope.orgs = orgs;
      });
    };

    $scope.deleteOrg = org => {
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
