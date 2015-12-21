define([
  'angular',
  'jquery',
  'app/core/config',
],
function (angular, $, config) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('panelLoader', function($compile, $parse) {
    return {
      restrict: 'E',
      link: function(scope, elem, attr) {
        var getter = $parse(attr.type), panelType = getter(scope);
        var module = config.panels[panelType].module;

        System.import(module).then(function() {
          var panelEl = angular.element(document.createElement('grafana-panel-' + panelType));
          elem.append(panelEl);
          $compile(panelEl)(scope);
        }).catch(function(err) {
          console.log('Failed to load panel:', err);
          scope.appEvent('alert-error', ['Panel Load Error', 'Failed to load panel ' + panelType + ', ' + err]);
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

  module.directive('panelResizer', function($rootScope) {
    return {
      restrict: 'E',
      template: '<span class="resize-panel-handle"></span>',
      link: function(scope, elem) {
        var resizing = false;
        var lastPanel = false;
        var handleOffset;
        var originalHeight;
        var originalWidth;
        var maxWidth;

        function dragStartHandler(e) {
          e.preventDefault();
          resizing = true;

          handleOffset = $(e.target).offset();
          originalHeight = parseInt(scope.row.height);
          originalWidth = scope.panel.span;
          maxWidth = $(document).width();

          lastPanel = scope.row.panels[scope.row.panels.length - 1];

          $('body').on('mousemove', moveHandler);
          $('body').on('mouseup', dragEndHandler);
        }

        function moveHandler(e) {
          scope.row.height = originalHeight + (e.pageY - handleOffset.top);
          scope.panel.span = originalWidth + (((e.pageX - handleOffset.left) / maxWidth) * 12);
          scope.panel.span = Math.min(Math.max(scope.panel.span, 1), 12);

          var rowSpan = scope.dashboard.rowSpan(scope.row);

          // auto adjust other panels
          if (Math.floor(rowSpan) < 14) {
            // last panel should not push row down
            if (lastPanel === scope.panel && rowSpan > 12) {
              lastPanel.span -= rowSpan - 12;
            }
            // reduce width of last panel so total in row is 12
            else if (lastPanel !== scope.panel) {
              lastPanel.span = lastPanel.span - (rowSpan - 12);
              lastPanel.span = Math.min(Math.max(lastPanel.span, 1), 12);
            }
          }

          scope.$apply(function() {
            scope.$broadcast('render');
          });
        }

        function dragEndHandler() {
          // if close to 12
          var rowSpan = scope.dashboard.rowSpan(scope.row);
          if (rowSpan < 12 && rowSpan > 11) {
            lastPanel.span +=  12 - rowSpan;
          }

          scope.$apply(function() {
            $rootScope.$broadcast('render');
          });

          $('body').off('mousemove', moveHandler);
          $('body').off('mouseup', dragEndHandler);
        }

        elem.on('mousedown', dragStartHandler);

        scope.$on("$destroy", function() {
          elem.off('mousedown', dragStartHandler);
        });
      }
    };
  });

});
