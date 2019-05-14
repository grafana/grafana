import AdminListUsersCtrl from './AdminListUsersCtrl';
import AdminEditUserCtrl from './AdminEditUserCtrl';
import AdminListOrgsCtrl from './AdminListOrgsCtrl';
import AdminEditOrgCtrl from './AdminEditOrgCtrl';
import StyleGuideCtrl from './StyleGuideCtrl';
import coreModule from 'app/core/core_module';
var AdminSettingsCtrl = /** @class */ (function () {
    /** @ngInject */
    function AdminSettingsCtrl($scope, backendSrv, navModelSrv) {
        this.navModel = navModelSrv.getNav('admin', 'server-settings', 0);
        backendSrv.get('/api/admin/settings').then(function (settings) {
            $scope.settings = settings;
        });
    }
    return AdminSettingsCtrl;
}());
var AdminHomeCtrl = /** @class */ (function () {
    /** @ngInject */
    function AdminHomeCtrl(navModelSrv) {
        this.navModel = navModelSrv.getNav('admin', 0);
    }
    return AdminHomeCtrl;
}());
coreModule.controller('AdminListUsersCtrl', AdminListUsersCtrl);
coreModule.controller('AdminEditUserCtrl', AdminEditUserCtrl);
coreModule.controller('AdminListOrgsCtrl', AdminListOrgsCtrl);
coreModule.controller('AdminEditOrgCtrl', AdminEditOrgCtrl);
coreModule.controller('AdminSettingsCtrl', AdminSettingsCtrl);
coreModule.controller('AdminHomeCtrl', AdminHomeCtrl);
coreModule.controller('StyleGuideCtrl', StyleGuideCtrl);
//# sourceMappingURL=index.js.map