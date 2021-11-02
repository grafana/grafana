import angular from 'angular';
import coreModule from 'app/core/core_module';
import { assign } from 'lodash';
import { setAngularLoader as setAngularLoaderInterface, } from '@grafana/runtime';
var AngularLoader = /** @class */ (function () {
    /** @ngInject */
    function AngularLoader($compile, $rootScope) {
        this.$compile = $compile;
        this.$rootScope = $rootScope;
    }
    AngularLoader.prototype.load = function (elem, scopeProps, template) {
        var scope = this.$rootScope.$new();
        assign(scope, scopeProps);
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
export function setAngularLoader(v) {
    setAngularLoaderInterface(v);
}
coreModule.service('angularLoader', AngularLoader);
//# sourceMappingURL=AngularLoader.js.map