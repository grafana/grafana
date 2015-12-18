define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('appConfigLoader', function($compile) {
    return {
      restrict: 'E',
      link: function(scope, elem) {
        var directive = 'grafana-app-default';
        //wait for the parent scope to be applied.
        scope.panelAdded = false;
        scope.$watch("current", function(newVal) {
          if (newVal && !scope.panelAdded) {
            if (newVal.module) {
              scope.panelAdded = true;
              directive = 'grafana-app-'+newVal.type;
              scope.require([newVal.module], function () {
                var panelEl = angular.element(document.createElement(directive));
                elem.append(panelEl);
                $compile(panelEl)(scope);
              });
            }
          }
        });
      }
    };
  });
});