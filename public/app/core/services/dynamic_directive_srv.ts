import angular from 'angular';
import coreModule from '../core_module';

class DynamicDirectiveSrv {
  /** @ngInject */
  constructor(private $compile) {}

  addDirective(element, name, scope) {
    const child = angular.element(document.createElement(name));
    this.$compile(child)(scope);

    element.empty();
    element.append(child);
  }

  link(scope, elem, attrs, options) {
    const directiveInfo = options.directive(scope);
    if (!directiveInfo || !directiveInfo.fn) {
      elem.empty();
      return;
    }

    if (!directiveInfo.fn.registered) {
      coreModule.directive(attrs.$normalize(directiveInfo.name), directiveInfo.fn);
      directiveInfo.fn.registered = true;
    }

    this.addDirective(elem, directiveInfo.name, scope);
  }

  create(options) {
    const directiveDef = {
      restrict: 'E',
      scope: options.scope,
      link: (scope, elem, attrs) => {
        if (options.watchPath) {
          let childScope = null;
          scope.$watch(options.watchPath, () => {
            if (childScope) {
              childScope.$destroy();
            }
            childScope = scope.$new();
            this.link(childScope, elem, attrs, options);
          });
        } else {
          this.link(scope, elem, attrs, options);
        }
      },
    };

    return directiveDef;
  }
}

coreModule.service('dynamicDirectiveSrv', DynamicDirectiveSrv);
