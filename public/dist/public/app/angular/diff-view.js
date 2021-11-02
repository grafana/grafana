import angular from 'angular';
import coreModule from '../core/core_module';
var DeltaCtrl = /** @class */ (function () {
    /** @ngInject */
    function DeltaCtrl() {
        var waitForCompile = function () { };
        this.observer = new MutationObserver(waitForCompile);
        var observerConfig = {
            attributes: true,
            attributeFilter: ['class'],
            characterData: false,
            childList: true,
            subtree: false,
        };
        this.observer.observe(angular.element('.delta-html')[0], observerConfig);
    }
    DeltaCtrl.prototype.$onDestroy = function () {
        this.observer.disconnect();
    };
    return DeltaCtrl;
}());
export { DeltaCtrl };
export function delta() {
    return {
        controller: DeltaCtrl,
        replace: false,
        restrict: 'A',
    };
}
coreModule.directive('diffDelta', delta);
// Link to JSON line number
var LinkJSONCtrl = /** @class */ (function () {
    /** @ngInject */
    function LinkJSONCtrl($scope, $rootScope, $anchorScroll) {
        this.$scope = $scope;
        this.$rootScope = $rootScope;
        this.$anchorScroll = $anchorScroll;
    }
    LinkJSONCtrl.prototype.goToLine = function (line) {
        var _this = this;
        var unbind;
        var scroll = function () {
            _this.$anchorScroll("l" + line);
            unbind();
        };
        this.$scope.switchView().then(function () {
            unbind = _this.$rootScope.$on('json-diff-ready', scroll.bind(_this));
        });
    };
    return LinkJSONCtrl;
}());
export { LinkJSONCtrl };
export function linkJson() {
    return {
        controller: LinkJSONCtrl,
        controllerAs: 'ctrl',
        replace: true,
        restrict: 'E',
        scope: {
            line: '@lineDisplay',
            link: '@lineLink',
            switchView: '&',
        },
        template: "<a class=\"diff-linenum btn btn-inverse btn-small\" ng-click=\"ctrl.goToLine(link)\">Line {{ line }}</a>",
    };
}
coreModule.directive('diffLinkJson', linkJson);
//# sourceMappingURL=diff-view.js.map