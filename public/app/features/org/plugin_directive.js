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
        var directive = 'grafana-plugin-core';
        if (scope.current.module) {
          directive = 'grafana-plugin-'+scope.current.type;
        }
        scope.require([scope.current.module], function () {
          var panelEl = angular.element(document.createElement(directive));
          elem.append(panelEl);
          $compile(panelEl)(scope);
        });
      }
    };
  });

  module.directive('grafanaPluginCore', function() {
    return {
      restrict: 'E',
      templateUrl: 'app/features/org/partials/pluginConfigCore.html',
      transclude: true,
      link: function(scope, elem) {
        console.log("grafana plugin core", scope, elem);
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