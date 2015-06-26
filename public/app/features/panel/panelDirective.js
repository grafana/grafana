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
            elem.append(panelEl);
            $compile(panelEl)(scope);
          });
        }
      };
    })
    .directive('grafanaPanel', function() {
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
    })
    .directive('panelResizer', function($rootScope) {
      return {
        restrict: 'E',
        template: '<span class="resize-panel-handle"></span>',
        link: function(scope, elem) {
          var resizing = false;
          var handleOffset;
          var originalHeight;
          var originalWidth;
          var maxWidth;

          function dragStartHandler(e) {
            e.preventDefault();
            console.log('start');
            resizing = true;

            handleOffset = $(e.target).offset();
            originalHeight = parseInt(scope.row.height);
            originalWidth = scope.panel.span;
            maxWidth = $(document).width();

            $('body').on('mousemove', moveHandler);
            $('body').on('mouseup', dragEndHandler);
          }

          function moveHandler(e) {
            scope.row.height = originalHeight + (e.pageY - handleOffset.top);
            scope.panel.span = originalWidth + (((e.pageX - handleOffset.left) / maxWidth) * 12);

            var rowSpan = scope.dashboard.rowSpan(scope.row);

            if (Math.floor(rowSpan) < 14) {
              scope.row.panels[scope.row.panels.length - 1].span = scope.row.panels[scope.row.panels.length - 1].span - (rowSpan - 12);
            }

            scope.$apply(function() {
              scope.$broadcast('render');
            });
          }

          function dragEndHandler() {
            console.log('end');
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
