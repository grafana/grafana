import angular from 'angular';

import coreModule from '../core_module';

class DynamicDirectiveSrv {
  static $inject = ['$compile'];

  constructor(private $compile: angular.ICompileService) {}

  addDirective(element: any, name: string, scope: any) {
    const child = angular.element(document.createElement(name));
    this.$compile(child)(scope);

    element.empty();
    element.append(child);
  }

  link(scope: any, elem: JQLite, attrs: any, options: any) {
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

  create(options: any) {
    const directiveDef = {
      restrict: 'E',
      scope: options.scope,
      link: (scope: any, elem: JQLite, attrs: any) => {
        if (options.watchPath) {
          let childScope: any = null;
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
