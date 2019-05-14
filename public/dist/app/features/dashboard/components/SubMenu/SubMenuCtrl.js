import angular from 'angular';
import _ from 'lodash';
var SubMenuCtrl = /** @class */ (function () {
    /** @ngInject */
    function SubMenuCtrl(variableSrv, $location) {
        this.variableSrv = variableSrv;
        this.$location = $location;
        this.annotations = this.dashboard.templating.list;
        this.variables = this.variableSrv.variables;
    }
    SubMenuCtrl.prototype.annotationStateChanged = function () {
        this.dashboard.startRefresh();
    };
    SubMenuCtrl.prototype.variableUpdated = function (variable) {
        this.variableSrv.variableUpdated(variable, true);
    };
    SubMenuCtrl.prototype.openEditView = function (editview) {
        var search = _.extend(this.$location.search(), { editview: editview });
        this.$location.search(search);
    };
    return SubMenuCtrl;
}());
export { SubMenuCtrl };
export function submenuDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/dashboard/components/SubMenu/template.html',
        controller: SubMenuCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            dashboard: '=',
        },
    };
}
angular.module('grafana.directives').directive('dashboardSubmenu', submenuDirective);
//# sourceMappingURL=SubMenuCtrl.js.map