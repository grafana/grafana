import angular from 'angular';
import coreModule from 'app/core/core_module';
import _ from 'lodash';

import {
  AngularComponent,
  AngularLoader as AngularLoaderInterface,
  setAngularLoader as setAngularLoaderInterface,
} from '@grafana/runtime';

export class AngularLoader implements AngularLoaderInterface {
  /** @ngInject */
  constructor(private $compile: any, private $rootScope: any) {}

  load(elem: any, scopeProps: any, template: string): AngularComponent {
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

export function setAngularLoader(v: AngularLoader) {
  setAngularLoaderInterface(v);
}

coreModule.service('angularLoader', AngularLoader);
