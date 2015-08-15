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
        var editorScope;

        scope.$watch("panel.datasource", function() {
          var datasource = scope.target.datasource || scope.panel.datasource;

          datasourceSrv.get(datasource).then(function(ds) {
            if (editorScope) {
              editorScope.$destroy();
              elem.empty();
            }

            editorScope = scope.$new();
            editorScope.datasource = ds;

            var panelEl = angular.element(document.createElement('metric-query-editor-' + ds.meta.type));
            elem.append(panelEl);
            $compile(panelEl)(editorScope);
          });
        });
      }
    };
  });

  module.directive('queryOptionsLoader', function($compile, $parse, datasourceSrv) {
    return {
      restrict: 'E',
      link: function(scope, elem) {
        var editorScope;

        scope.$watch("panel.datasource", function() {

          datasourceSrv.get(scope.panel.datasource).then(function(ds) {
            if (editorScope) {
              editorScope.$destroy();
              elem.empty();
            }

            editorScope = scope.$new();
            var panelEl = angular.element(document.createElement('metric-query-options-' + ds.meta.type));
            elem.append(panelEl);
            $compile(panelEl)(editorScope);
          });
        });
      }
    };
  });

});
