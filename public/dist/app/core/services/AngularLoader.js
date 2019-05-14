import angular from 'angular';
import coreModule from 'app/core/core_module';
import _ from 'lodash';
var AngularLoader = /** @class */ (function () {
    /** @ngInject */
    function AngularLoader($compile, $rootScope) {
        this.$compile = $compile;
        this.$rootScope = $rootScope;
    }
    AngularLoader.prototype.load = function (elem, scopeProps, template) {
        var scope = this.$rootScope.$new();
        _.assign(scope, scopeProps);
        var compiledElem = this.$compile(template)(scope);
        var rootNode = angular.element(elem);
        rootNode.append(compiledElem);
        return {
            destroy: function () {
                scope.$destroy();
                compiledElem.remove();
            },
            digest: function () {
                if (!scope.$$phase) {
                    scope.$digest();
                }
            },
            getScope: function () {
                return scope;
            },
        };
    };
    return AngularLoader;
}());
export { AngularLoader };
coreModule.service('angularLoader', AngularLoader);
var angularLoaderInstance;
export function setAngularLoader(pl) {
    angularLoaderInstance = pl;
}
// away to access it from react
export function getAngularLoader() {
    return angularLoaderInstance;
}
//# sourceMappingURL=AngularLoader.js.map