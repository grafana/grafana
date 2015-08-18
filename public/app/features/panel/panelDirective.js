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

  module.service('dynamicDirectiveSrv', function($compile, $parse, datasourceSrv) {
    var self = this;

    this.addDirective = function(options, type, editorScope) {
      var panelEl = angular.element(document.createElement(options.name + '-' + type));
      options.parentElem.append(panelEl);
      $compile(panelEl)(editorScope);
    };

    this.define = function(options) {
      var editorScope;
      options.scope.$watch(options.datasourceProperty, function(newVal) {
        if (editorScope) {
          editorScope.$destroy();
          options.parentElem.empty();
        }

        editorScope = options.scope.$new();
        datasourceSrv.get(newVal).then(function(ds) {
          self.addDirective(options, ds.meta.type, editorScope);
        });
      });
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

            if (!scope.target.refId) {
              scope.target.refId = 'A';
            }

            var panelEl = angular.element(document.createElement('metric-query-editor-' + ds.meta.type));
            elem.append(panelEl);
            $compile(panelEl)(editorScope);
          });
        });
      }
    };
  });

  module.directive('datasourceEditorView', function(dynamicDirectiveSrv) {
    return {
      restrict: 'E',
      link: function(scope, elem, attrs) {
        dynamicDirectiveSrv.define({
          datasourceProperty: attrs.datasource,
          name: attrs.name,
          scope: scope,
          parentElem: elem,
        });
      }
    };
  });

});
