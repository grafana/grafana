import { FolderPageLoader } from './services/FolderPageLoader';
import locationUtil from 'app/core/utils/location_util';
var FolderDashboardsCtrl = /** @class */ (function () {
    /** @ngInject */
    function FolderDashboardsCtrl(backendSrv, navModelSrv, $routeParams, $location) {
        this.backendSrv = backendSrv;
        this.$routeParams = $routeParams;
        if (this.$routeParams.uid) {
            this.uid = $routeParams.uid;
            var loader = new FolderPageLoader(this.backendSrv);
            loader.load(this, this.uid, 'manage-folder-dashboards').then(function (folder) {
                var url = locationUtil.stripBaseFromUrl(folder.url);
                if (url !== $location.path()) {
                    $location.path(url).replace();
                }
            });
        }
    }
    return FolderDashboardsCtrl;
}());
export default FolderDashboardsCtrl;
//# sourceMappingURL=FolderDashboardsCtrl.js.map