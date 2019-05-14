var AdminListOrgsCtrl = /** @class */ (function () {
    /** @ngInject */
    function AdminListOrgsCtrl($scope, backendSrv, navModelSrv) {
        $scope.init = function () {
            $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);
            $scope.getOrgs();
        };
        $scope.getOrgs = function () {
            backendSrv.get('/api/orgs').then(function (orgs) {
                $scope.orgs = orgs;
            });
        };
        $scope.deleteOrg = function (org) {
            $scope.appEvent('confirm-modal', {
                title: 'Delete',
                text: 'Do you want to delete organization ' + org.name + '?',
                text2: 'All dashboards for this organization will be removed!',
                icon: 'fa-trash',
                yesText: 'Delete',
                onConfirm: function () {
                    backendSrv.delete('/api/orgs/' + org.id).then(function () {
                        $scope.getOrgs();
                    });
                },
            });
        };
        $scope.init();
    }
    return AdminListOrgsCtrl;
}());
export default AdminListOrgsCtrl;
//# sourceMappingURL=AdminListOrgsCtrl.js.map