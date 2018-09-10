import angular from 'angular';
import coreModule from 'app/core/core_module';
import _ from 'lodash';

export interface AngularComponent {
  destroy();
}

export class AngularLoader {
  /** @ngInject */
  constructor(private $compile, private $rootScope) {}

  load(elem, scopeProps, template): AngularComponent {
    const scope = this.$rootScope.$new();

    _.assign(scope, scopeProps);

    const compiledElem = this.$compile(template)(scope);
    const rootNode = angular.element(elem);
    rootNode.append(compiledElem);

    return {
      destroy: () => {
        scope.$destroy();
        compiledElem.remove();
      },
    };
  }
}

coreModule.service('angularLoader', AngularLoader);

let angularLoaderInstance: AngularLoader;

export function setAngularLoader(pl: AngularLoader) {
  angularLoaderInstance = pl;
}

// away to access it from react
export function getAngularLoader(): AngularLoader {
  return angularLoaderInstance;
}
