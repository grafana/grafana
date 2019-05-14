import store from 'app/core/store';
import coreModule from 'app/core/core_module';
var template = "\n<div class=\"layout-selector\">\n  <button ng-click=\"ctrl.listView()\" ng-class=\"{active: ctrl.mode === 'list'}\">\n    <i class=\"fa fa-list\"></i>\n  </button>\n  <button ng-click=\"ctrl.gridView()\" ng-class=\"{active: ctrl.mode === 'grid'}\">\n    <i class=\"fa fa-th\"></i>\n  </button>\n</div>\n";
var LayoutSelectorCtrl = /** @class */ (function () {
    /** @ngInject */
    function LayoutSelectorCtrl($rootScope) {
        this.$rootScope = $rootScope;
        this.mode = store.get('grafana.list.layout.mode') || 'grid';
    }
    LayoutSelectorCtrl.prototype.listView = function () {
        this.mode = 'list';
        store.set('grafana.list.layout.mode', 'list');
        this.$rootScope.appEvent('layout-mode-changed', 'list');
    };
    LayoutSelectorCtrl.prototype.gridView = function () {
        this.mode = 'grid';
        store.set('grafana.list.layout.mode', 'grid');
        this.$rootScope.appEvent('layout-mode-changed', 'grid');
    };
    return LayoutSelectorCtrl;
}());
export { LayoutSelectorCtrl };
/** @ngInject */
export function layoutSelector() {
    return {
        restrict: 'E',
        controller: LayoutSelectorCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {},
        template: template,
    };
}
/** @ngInject */
export function layoutMode($rootScope) {
    return {
        restrict: 'A',
        scope: {},
        link: function (scope, elem) {
            var layout = store.get('grafana.list.layout.mode') || 'grid';
            var className = 'card-list-layout-' + layout;
            elem.addClass(className);
            $rootScope.onAppEvent('layout-mode-changed', function (evt, newLayout) {
                elem.removeClass(className);
                className = 'card-list-layout-' + newLayout;
                elem.addClass(className);
            }, scope);
        },
    };
}
coreModule.directive('layoutSelector', layoutSelector);
coreModule.directive('layoutMode', layoutMode);
//# sourceMappingURL=layout_selector.js.map