import angular from 'angular';
import coreModule from 'app/core/core_module';
import _ from 'lodash';

import { AngularComponent, AngularLoader } from '@grafana/runtime';

export class AngularLoaderClass implements AngularLoader {
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

coreModule.service('angularLoader', AngularLoaderClass);
