///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import angular from 'angular';

function appConfigLoader($compile, $parse) {
  return {
    restrict: 'E',
    scope: {
      appModel: "="
    },
    link: function(scope, elem, attr) {
      debugger;
      System.import(scope.appModel.module).then(function(appModule) {
        var directive = appModule.directives.configView;
        if (!directive) {
          return;
        }
        if (!directive.hasBeenRegistered) {
          angular.module('grafana.directives').directive('nginxConfig', directive);
          directive.hasBeenRegistered = true;
        }

        var panelEl = angular.element(document.createElement('nginx-config'));
        elem.append(panelEl);
        $compile(panelEl)(scope);
      }).catch(function(err) {
        console.log('Failed to load panel:', err);
        scope.appEvent('alert-error', ['App Error', err.toString()]);
      });
    }
  };
}


angular.module('grafana.directives').directive('appConfigLoader', appConfigLoader);
