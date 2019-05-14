import angular from 'angular';
import { saveAs } from 'file-saver';
import coreModule from 'app/core/core_module';
import { DashboardExporter } from './DashboardExporter';
var DashExportCtrl = /** @class */ (function () {
    /** @ngInject */
    function DashExportCtrl(dashboardSrv, datasourceSrv, $scope, $rootScope) {
        this.dashboardSrv = dashboardSrv;
        this.$scope = $scope;
        this.$rootScope = $rootScope;
        this.exporter = new DashboardExporter(datasourceSrv);
        this.dash = this.dashboardSrv.getCurrent();
    }
    DashExportCtrl.prototype.saveDashboardAsFile = function () {
        var _this = this;
        if (this.shareExternally) {
            this.exporter.makeExportable(this.dash).then(function (dashboardJson) {
                _this.$scope.$apply(function () {
                    _this.openSaveAsDialog(dashboardJson);
                });
            });
        }
        else {
            this.openSaveAsDialog(this.dash.getSaveModelClone());
        }
    };
    DashExportCtrl.prototype.viewJson = function () {
        var _this = this;
        if (this.shareExternally) {
            this.exporter.makeExportable(this.dash).then(function (dashboardJson) {
                _this.$scope.$apply(function () {
                    _this.openJsonModal(dashboardJson);
                });
            });
        }
        else {
            this.openJsonModal(this.dash.getSaveModelClone());
        }
    };
    DashExportCtrl.prototype.openSaveAsDialog = function (dash) {
        var blob = new Blob([angular.toJson(dash, true)], {
            type: 'application/json;charset=utf-8',
        });
        saveAs(blob, dash.title + '-' + new Date().getTime() + '.json');
    };
    DashExportCtrl.prototype.openJsonModal = function (clone) {
        var model = {
            object: clone,
            enableCopy: true,
        };
        this.$rootScope.appEvent('show-modal', {
            src: 'public/app/partials/edit_json.html',
            model: model,
        });
        this.dismiss();
    };
    return DashExportCtrl;
}());
export { DashExportCtrl };
export function dashExportDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/dashboard/components/DashExportModal/template.html',
        controller: DashExportCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: { dismiss: '&' },
    };
}
coreModule.directive('dashExportModal', dashExportDirective);
//# sourceMappingURL=DashExportCtrl.js.map