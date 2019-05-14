import coreModule from 'app/core/core_module';
var obj2string = function (obj) {
    return Object.keys(obj)
        .reduce(function (acc, curr) { return acc.concat(curr + '=' + obj[curr]); }, [])
        .join();
};
var GeneralTabCtrl = /** @class */ (function () {
    /** @ngInject */
    function GeneralTabCtrl($scope) {
        var _this = this;
        this.panelCtrl = $scope.ctrl;
        var updatePanel = function () {
            console.log('panel.render()');
            _this.panelCtrl.panel.render();
        };
        var generateValueFromPanel = function (scope) {
            var panel = scope.ctrl.panel;
            var panelPropsToTrack = ['title', 'description', 'transparent', 'repeat', 'repeatDirection', 'minSpan'];
            var panelPropsString = panelPropsToTrack
                .map(function (prop) { return prop + '=' + (panel[prop] && panel[prop].toString ? panel[prop].toString() : panel[prop]); })
                .join();
            var panelLinks = panel.links || [];
            var panelLinksString = panelLinks.map(obj2string).join();
            return panelPropsString + panelLinksString;
        };
        $scope.$watch(generateValueFromPanel, updatePanel, true);
    }
    return GeneralTabCtrl;
}());
export { GeneralTabCtrl };
/** @ngInject */
export function generalTab() {
    'use strict';
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/panel/partials/general_tab.html',
        controller: GeneralTabCtrl,
    };
}
coreModule.directive('panelGeneralTab', generalTab);
//# sourceMappingURL=GeneralTabCtrl.js.map