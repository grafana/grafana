define([
  'angular',
  'jquery',
  'config',
],
function (angular, $, config) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelLoader', function($compile, $parse) {
      return {
        restrict: 'E',
        link: function(scope, elem, attr) {
          var getter = $parse(attr.type), panelType = getter(scope);
          var panelPath = config.panels[panelType].path;

          scope.require([panelPath + "/module"], function () {
            var panelEl = angular.element(document.createElement('grafana-panel-' + panelType));
            console.log(panelEl);
            elem.append(panelEl);
            $compile(panelEl)(scope);
          });
        }
      };
    }).directive('grafanaPanel', function() {
      return {
        restrict: 'E',
        templateUrl: 'app/features/panel/partials/panel.html',
        transclude: true,
        link: function(scope, elem) {
          var panelContainer = elem.find('.panel-container');

          scope.$watchGroup(['fullscreen', 'height', 'panel.height', 'row.height'], function() {
            panelContainer.css({ minHeight: scope.height || scope.panel.height || scope.row.height, display: 'block' });
            elem.toggleClass('panel-fullscreen', scope.fullscreen ? true : false);
          });
        }
      };
    });
});
