import coreModule from 'app/core/core_module';
var template = "\n<select class=\"gf-form-input\" ng-model=\"ctrl.model\" ng-options=\"f.value as f.text for f in ctrl.options\"></select>\n";
var DashboardSelectorCtrl = /** @class */ (function () {
    /** @ngInject */
    function DashboardSelectorCtrl(backendSrv) {
        this.backendSrv = backendSrv;
    }
    DashboardSelectorCtrl.prototype.$onInit = function () {
        var _this = this;
        this.options = [{ value: 0, text: 'Default' }];
        return this.backendSrv.search({ starred: true }).then(function (res) {
            res.forEach(function (dash) {
                _this.options.push({ value: dash.id, text: dash.title });
            });
        });
    };
    return DashboardSelectorCtrl;
}());
export { DashboardSelectorCtrl };
export function dashboardSelector() {
    return {
        restrict: 'E',
        controller: DashboardSelectorCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        template: template,
        scope: {
            model: '=',
        },
    };
}
coreModule.directive('dashboardSelector', dashboardSelector);
//# sourceMappingURL=dashboard_selector.js.map