import angular from 'angular';
import config from 'app/core/config';
var NewOrgCtrl = /** @class */ (function () {
    /** @ngInject */
    function NewOrgCtrl($scope, $http, backendSrv, navModelSrv) {
        $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);
        $scope.newOrg = { name: '' };
        $scope.createOrg = function () {
            backendSrv.post('/api/orgs/', $scope.newOrg).then(function (result) {
                backendSrv.post('/api/user/using/' + result.orgId).then(function () {
                    window.location.href = config.appSubUrl + '/org';
                });
            });
        };
    }
    return NewOrgCtrl;
}());
export { NewOrgCtrl };
angular.module('grafana.controllers').controller('NewOrgCtrl', NewOrgCtrl);
//# sourceMappingURL=NewOrgCtrl.js.map