import angular from 'angular';
import config from 'app/core/config';
var SelectOrgCtrl = /** @class */ (function () {
    /** @ngInject */
    function SelectOrgCtrl($scope, backendSrv, contextSrv) {
        contextSrv.sidemenu = false;
        $scope.navModel = {
            main: {
                icon: 'gicon gicon-branding',
                subTitle: 'Preferences',
                text: 'Select active organization',
            },
        };
        $scope.init = function () {
            $scope.getUserOrgs();
        };
        $scope.getUserOrgs = function () {
            backendSrv.get('/api/user/orgs').then(function (orgs) {
                $scope.orgs = orgs;
            });
        };
        $scope.setUsingOrg = function (org) {
            backendSrv.post('/api/user/using/' + org.orgId).then(function () {
                window.location.href = config.appSubUrl + '/';
            });
        };
        $scope.init();
    }
    return SelectOrgCtrl;
}());
export { SelectOrgCtrl };
angular.module('grafana.controllers').controller('SelectOrgCtrl', SelectOrgCtrl);
//# sourceMappingURL=SelectOrgCtrl.js.map