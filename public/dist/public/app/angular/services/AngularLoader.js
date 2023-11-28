import angular from 'angular';
import { assign } from 'lodash';
import coreModule from 'app/angular/core_module';
export class AngularLoader {
    constructor($compile, $rootScope) {
        this.$compile = $compile;
        this.$rootScope = $rootScope;
    }
    load(elem, scopeProps, template) {
        const scope = this.$rootScope.$new();
        assign(scope, scopeProps);
        const compiledElem = this.$compile(template)(scope);
        const rootNode = angular.element(elem);
        rootNode.append(compiledElem);
        return {
            destroy: () => {
                scope.$destroy();
                compiledElem.remove();
            },
            digest: () => {
                if (!scope.$$phase) {
                    scope.$digest();
                }
            },
            getScope: () => {
                return scope;
            },
        };
    }
}
AngularLoader.$inject = ['$compile', '$rootScope'];
coreModule.service('angularLoader', AngularLoader);
//# sourceMappingURL=AngularLoader.js.map