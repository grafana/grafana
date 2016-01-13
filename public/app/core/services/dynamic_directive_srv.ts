///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import coreModule from '../core_module';

class DynamicDirectiveSrv {

  /** @ngInject */
  constructor(private $compile, private $parse) {}

  addDirective(element, name, scope) {
    element.empty();
    element.append(angular.element(document.createElement(name)));
    this.$compile(element)(scope);
  }

  create(options) {
    let directiveDef = {
      restrict: 'E',
      scope: options.scope,
      link: function(scope, elem) {
        options.directive(scope).then(directiveInfo => {
          if (!directiveInfo) {
            return;
          }

          if (directiveInfo.fn.hasBeenRegistered) {
            coreModule.directive(directiveInfo.name, directiveInfo.fn);
            directiveInfo.fn.hasBeenRegistered = true;
          }
        });
      }
    };

    return directiveDef;
  }
}

coreModule.service('dynamicDirectiveSrv', DynamicDirectiveSrv);


