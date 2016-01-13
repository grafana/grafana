///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import angular from 'angular';
import coreModule from '../core_module';

class DynamicDirectiveSrv {

  /** @ngInject */
  constructor(private $compile, private $parse, private datasourceSrv) {
  }

  addDirective(element, name, scope) {
    element.empty();
    element.append(angular.element(document.createElement(name)));
    this.$compile(element)(scope);
  }

  define(options) {
    var editorScope;
    options.scope.$watch(options.datasourceProperty, newVal => {
      if (editorScope) {
        editorScope.$destroy();
        options.parentElem.empty();
      }

      editorScope = options.scope.$new();
      this.datasourceSrv.get(newVal).then(ds => {
        this.addDirective(options.parentElem, options.name + '-' + ds.meta.id, editorScope);
      });
    });
  }
}

coreModule.service('dynamicDirectiveSrv', DynamicDirectiveSrv);


