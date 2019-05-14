import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
var DashImportListCtrl = /** @class */ (function () {
    /** @ngInject */
    function DashImportListCtrl($scope, backendSrv, $rootScope) {
        var _this = this;
        this.backendSrv = backendSrv;
        this.$rootScope = $rootScope;
        this.dashboards = [];
        backendSrv.get("/api/plugins/" + this.plugin.id + "/dashboards").then(function (dashboards) {
            _this.dashboards = dashboards;
        });
        appEvents.on('dashboard-list-import-all', this.importAll.bind(this), $scope);
    }
    DashImportListCtrl.prototype.importAll = function (payload) {
        return this.importNext(0)
            .then(function () {
            payload.resolve('All dashboards imported');
        })
            .catch(function (err) {
            payload.reject(err);
        });
    };
    DashImportListCtrl.prototype.importNext = function (index) {
        var _this = this;
        return this.import(this.dashboards[index], true).then(function () {
            if (index + 1 < _this.dashboards.length) {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        _this.importNext(index + 1).then(function () {
                            resolve();
                        });
                    }, 500);
                });
            }
            else {
                return Promise.resolve();
            }
        });
    };
    DashImportListCtrl.prototype.import = function (dash, overwrite) {
        var _this = this;
        var installCmd = {
            pluginId: this.plugin.id,
            path: dash.path,
            overwrite: overwrite,
            inputs: [],
        };
        if (this.datasource) {
            installCmd.inputs.push({
                name: '*',
                type: 'datasource',
                pluginId: this.datasource.type,
                value: this.datasource.name,
            });
        }
        return this.backendSrv.post("/api/dashboards/import", installCmd).then(function (res) {
            _this.$rootScope.appEvent('alert-success', ['Dashboard Imported', dash.title]);
            _.extend(dash, res);
        });
    };
    DashImportListCtrl.prototype.remove = function (dash) {
        var _this = this;
        this.backendSrv.delete('/api/dashboards/' + dash.importedUri).then(function () {
            _this.$rootScope.appEvent('alert-success', ['Dashboard Deleted', dash.title]);
            dash.imported = false;
        });
    };
    return DashImportListCtrl;
}());
export { DashImportListCtrl };
export function dashboardImportList() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/plugins/import_list/import_list.html',
        controller: DashImportListCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            plugin: '=',
            datasource: '=',
        },
    };
}
coreModule.directive('dashboardImportList', dashboardImportList);
//# sourceMappingURL=import_list.js.map