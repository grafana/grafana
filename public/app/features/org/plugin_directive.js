define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('pluginConfigLoader', function($compile) {
    return {
      restrict: 'E',
      link: function(scope, elem) {
        var directive = 'grafana-app-core';
        //wait for the parent scope to be applied.
        scope.$watch("current", function(newVal) {
          if (newVal) {
            if (newVal.module) {
              directive = 'grafana-app-'+newVal.type;
            }
            scope.require([newVal.module], function () {
              var panelEl = angular.element(document.createElement(directive));
              elem.append(panelEl);
              $compile(panelEl)(scope);
            });
          }
        });
      }
    };
  });

  module.directive('grafanaAppCore', function() {
    return {
      restrict: 'E',
      templateUrl: 'app/features/org/partials/appConfigCore.html',
      transclude: true,
      link: function(scope) {
        scope.update = function() {
          //Perform custom save events to the plugins own backend if needed.

          // call parent update to commit the change to the plugin object.
          // this will cause the page to reload.
          scope._update();
        };
      }
    };
  });
});