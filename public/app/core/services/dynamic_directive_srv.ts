///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import coreModule from '../core_module';

class DynamicDirectiveSrv {

  /** @ngInject */
  constructor(private $compile, private $parse) {}

  addDirective(element, name, scope) {
    var child = angular.element(document.createElement(name));
    this.$compile(child)(scope);

    element.empty();
    element.append(child);
  }

  create(options) {
    let directiveDef = {
      restrict: 'E',
      scope: options.scope,
      link: (scope, elem, attrs) => {
        options.directive(scope).then(directiveInfo => {
          if (!directiveInfo) {
            return;
          }

          if (!directiveInfo.fn.registered) {
            coreModule.directive(attrs.$normalize(directiveInfo.name), directiveInfo.fn);
            directiveInfo.fn.registered = true;
          }

          this.addDirective(elem, directiveInfo.name, scope);
        }).catch(function(err) {
          console.log('Dynamic directive load error: ', err);
        });
      }
    };

    return directiveDef;
  }
}

coreModule.service('dynamicDirectiveSrv', DynamicDirectiveSrv);


