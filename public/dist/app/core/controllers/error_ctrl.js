import config from 'app/core/config';
import coreModule from '../core_module';
import appEvents from 'app/core/app_events';
var ErrorCtrl = /** @class */ (function () {
    /** @ngInject */
    function ErrorCtrl($scope, contextSrv, navModelSrv) {
        $scope.navModel = navModelSrv.getNotFoundNav();
        $scope.appSubUrl = config.appSubUrl;
        if (!contextSrv.isSignedIn) {
            appEvents.emit('toggle-sidemenu-hidden');
        }
        $scope.$on('destroy', function () {
            if (!contextSrv.isSignedIn) {
                appEvents.emit('toggle-sidemenu-hidden');
            }
        });
    }
    return ErrorCtrl;
}());
export { ErrorCtrl };
coreModule.controller('ErrorCtrl', ErrorCtrl);
//# sourceMappingURL=error_ctrl.js.map