import angular from 'angular';
import config from 'app/core/config';
var ChangePasswordCtrl = /** @class */ (function () {
    /** @ngInject */
    function ChangePasswordCtrl($scope, backendSrv, $location, navModelSrv) {
        $scope.command = {};
        $scope.authProxyEnabled = config.authProxyEnabled;
        $scope.ldapEnabled = config.ldapEnabled;
        $scope.navModel = navModelSrv.getNav('profile', 'change-password', 0);
        $scope.changePassword = function () {
            if (!$scope.userForm.$valid) {
                return;
            }
            if ($scope.command.newPassword !== $scope.command.confirmNew) {
                $scope.appEvent('alert-warning', ['New passwords do not match', '']);
                return;
            }
            backendSrv.put('/api/user/password', $scope.command).then(function () {
                $location.path('profile');
            });
        };
    }
    return ChangePasswordCtrl;
}());
export { ChangePasswordCtrl };
angular.module('grafana.controllers').controller('ChangePasswordCtrl', ChangePasswordCtrl);
//# sourceMappingURL=ChangePasswordCtrl.js.map