import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
var MoveToFolderCtrl = /** @class */ (function () {
    /** @ngInject */
    function MoveToFolderCtrl(backendSrv) {
        this.backendSrv = backendSrv;
        this.isValidFolderSelection = true;
    }
    MoveToFolderCtrl.prototype.onFolderChange = function (folder) {
        this.folder = folder;
    };
    MoveToFolderCtrl.prototype.save = function () {
        var _this = this;
        return this.backendSrv.moveDashboards(this.dashboards, this.folder).then(function (result) {
            if (result.successCount > 0) {
                var header = "Dashboard" + (result.successCount === 1 ? '' : 's') + " Moved";
                var msg = result.successCount + " dashboard" + (result.successCount === 1 ? '' : 's') + " moved to " + _this.folder.title;
                appEvents.emit('alert-success', [header, msg]);
            }
            if (result.totalCount === result.alreadyInFolderCount) {
                appEvents.emit('alert-error', ['Error', "Dashboards already belongs to folder " + _this.folder.title]);
            }
            _this.dismiss();
            return _this.afterSave();
        });
    };
    MoveToFolderCtrl.prototype.onEnterFolderCreation = function () {
        this.isValidFolderSelection = false;
    };
    MoveToFolderCtrl.prototype.onExitFolderCreation = function () {
        this.isValidFolderSelection = true;
    };
    return MoveToFolderCtrl;
}());
export { MoveToFolderCtrl };
export function moveToFolderModal() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/manage-dashboards/components/MoveToFolderModal/template.html',
        controller: MoveToFolderCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            dismiss: '&',
            dashboards: '=',
            afterSave: '&',
        },
    };
}
coreModule.directive('moveToFolderModal', moveToFolderModal);
//# sourceMappingURL=MoveToFolderCtrl.js.map