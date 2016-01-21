///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import config from 'app/core/config';

import {unknownPanelDirective} from '../../plugins/panel/unknown/module';

var directiveModule = angular.module('grafana.directives');

/** @ngInject */
function panelLoader($compile, dynamicDirectiveSrv) {
  return {
    restrict: 'E',
    link: function(scope, elem, attrs) {

      function addDirective(name, component) {
        if (!component.registered) {
          directiveModule.component(attrs.$normalize(name), component);
          component.registered = true;
        }

        var child = angular.element(document.createElement(name));
        child.attr('dashboard', 'dashboard');
        child.attr('panel', 'panel');
        $compile(child)(scope);

        elem.empty();
        elem.append(child);
      }

      var panelElemName = 'panel-directive-' + scope.panel.type;
      let panelInfo = config.panels[scope.panel.type];
      if (!panelInfo) {
        addDirective(panelElemName, unknownPanelDirective);
      }

      System.import(panelInfo.module).then(function(panelModule) {
        addDirective(panelElemName, panelModule.component);
      }).catch(err => {
        console.log('Panel err: ', err);
      });
    }
  };
}

angular.module('grafana.directives').directive('panelLoader', panelLoader);
