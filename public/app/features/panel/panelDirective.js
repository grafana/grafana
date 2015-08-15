define([
  'angular',
  'jquery',
  'config',
],
function (angular, $, config) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('panelLoader', function($compile, $parse) {
    return {
      restrict: 'E',
      link: function(scope, elem, attr) {
        var getter = $parse(attr.type), panelType = getter(scope);
        var panelPath = config.panels[panelType].path;

        scope.require([panelPath + "/module"], function () {
          var panelEl = angular.element(document.createElement('grafana-panel-' + panelType));
          elem.append(panelEl);
          $compile(panelEl)(scope);
        });
      }
    };
  });

  module.directive('grafanaPanel', function() {
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

  module.directive('queryEditorLoader', function($compile, $parse, datasourceSrv) {
    return {
      restrict: 'E',
      link: function(scope, elem) {
        datasourceSrv.get(scope.panel.datasource).then(function(ds) {
          var panelEl = angular.element(document.createElement('metric-query-editor-' + ds.meta.type));
          elem.append(panelEl);
          $compile(panelEl)(scope);
        });
      }
    };
  });

});
