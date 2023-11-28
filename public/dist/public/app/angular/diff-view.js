import angular from 'angular';
import coreModule from './core_module';
export class DeltaCtrl {
    constructor() {
        const waitForCompile = () => { };
        this.observer = new MutationObserver(waitForCompile);
        const observerConfig = {
            attributes: true,
            attributeFilter: ['class'],
            characterData: false,
            childList: true,
            subtree: false,
        };
        this.observer.observe(angular.element('.delta-html')[0], observerConfig);
    }
    $onDestroy() {
        this.observer.disconnect();
    }
}
export function delta() {
    return {
        controller: DeltaCtrl,
        replace: false,
        restrict: 'A',
    };
}
coreModule.directive('diffDelta', delta);
// Link to JSON line number
export class LinkJSONCtrl {
    constructor($scope, $rootScope, $anchorScroll) {
        this.$scope = $scope;
        this.$rootScope = $rootScope;
        this.$anchorScroll = $anchorScroll;
    }
    goToLine(line) {
        let unbind;
        const scroll = () => {
            this.$anchorScroll(`l${line}`);
            unbind();
        };
        this.$scope.switchView().then(() => {
            unbind = this.$rootScope.$on('json-diff-ready', scroll.bind(this));
        });
    }
}
LinkJSONCtrl.$inject = ['$scope', '$rootScope', '$anchorScroll'];
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
        template: `<a class="diff-linenum btn btn-inverse btn-small" ng-click="ctrl.goToLine(link)">Line {{ line }}</a>`,
    };
}
coreModule.directive('diffLinkJson', linkJson);
//# sourceMappingURL=diff-view.js.map