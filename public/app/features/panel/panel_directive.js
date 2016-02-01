define([
  'angular',
  'jquery',
],
function (angular, $) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('grafanaPanel', function() {
    return {
      restrict: 'E',
      templateUrl: 'public/app/features/panel/partials/panel.html',
      transclude: true,
      scope: { ctrl: "=" },
      link: function(scope, elem) {
        var panelContainer = elem.find('.panel-container');
        var ctrl = scope.ctrl;
        scope.$watchGroup(['ctrl.fullscreen', 'ctrl.height', 'ctrl.panel.height', 'ctrl.row.height'], function() {
          panelContainer.css({ minHeight: ctrl.height || ctrl.panel.height || ctrl.row.height, display: 'block' });
          elem.toggleClass('panel-fullscreen', ctrl.fullscreen ? true : false);
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
        var ctrl = scope.ctrl;
        var handleOffset;
        var originalHeight;
        var originalWidth;
        var maxWidth;

        function dragStartHandler(e) {
          e.preventDefault();
          resizing = true;

          handleOffset = $(e.target).offset();
          originalHeight = parseInt(ctrl.row.height);
          originalWidth = ctrl.panel.span;
          maxWidth = $(document).width();

          lastPanel = ctrl.row.panels[ctrl.row.panels.length - 1];

          $('body').on('mousemove', moveHandler);
          $('body').on('mouseup', dragEndHandler);
        }

        function moveHandler(e) {
          ctrl.row.height = originalHeight + (e.pageY - handleOffset.top);
          ctrl.panel.span = originalWidth + (((e.pageX - handleOffset.left) / maxWidth) * 12);
          ctrl.panel.span = Math.min(Math.max(ctrl.panel.span, 1), 12);

          var rowSpan = ctrl.dashboard.rowSpan(ctrl.row);

          // auto adjust other panels
          if (Math.floor(rowSpan) < 14) {
            // last panel should not push row down
            if (lastPanel === ctrl.panel && rowSpan > 12) {
              lastPanel.span -= rowSpan - 12;
            }
            // reduce width of last panel so total in row is 12
            else if (lastPanel !== ctrl.panel) {
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
          var rowSpan = ctrl.dashboard.rowSpan(ctrl.row);
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
