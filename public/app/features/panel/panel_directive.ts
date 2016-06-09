///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import $ from 'jquery';

var module = angular.module('grafana.directives');

var panelTemplate = `
  <div class="panel-container" ng-class="{'panel-transparent': ctrl.panel.transparent}">
    <div class="panel-header">
      <span class="alert-error panel-error small pointer" ng-if="ctrl.error" ng-click="ctrl.openInspector()">
        <span data-placement="top" bs-tooltip="ctrl.error">
          <i class="fa fa-exclamation"></i><span class="panel-error-arrow"></span>
        </span>
      </span>

      <span class="panel-loading" ng-show="ctrl.loading">
        <i class="fa fa-spinner fa-spin"></i>
      </span>

      <div class="panel-title-container drag-handle" panel-menu></div>
    </div>

    <div class="panel-content">
      <ng-transclude></ng-transclude>
    </div>
    <panel-resizer></panel-resizer>
  </div>

  <div class="panel-full-edit" ng-if="ctrl.editMode">
    <div class="tabbed-view tabbed-view--panel-edit">
      <div class="tabbed-view-header">
        <h2 class="tabbed-view-title">
          {{ctrl.pluginName}}
        </h2>

        <ul class="gf-tabs">
          <li class="gf-tabs-item" ng-repeat="tab in ::ctrl.editorTabs">
            <a class="gf-tabs-link" ng-click="ctrl.changeTab($index)" ng-class="{active: ctrl.editorTabIndex === $index}">
              {{::tab.title}}
            </a>
          </li>
        </ul>

        <button class="tabbed-view-close-btn" ng-click="ctrl.exitFullscreen();">
          <i class="fa fa-remove"></i>
        </button>
      </div>

      <div class="tabbed-view-body">
        <div ng-repeat="tab in ctrl.editorTabs" ng-if="ctrl.editorTabIndex === $index">
          <panel-editor-tab editor-tab="tab" ctrl="ctrl" index="$index"></panel-editor-tab>
        </div>
      </div>
    </div>
  </div>
`;

module.directive('grafanaPanel', function() {
  return {
    restrict: 'E',
    template: panelTemplate,
    transclude: true,
    scope: { ctrl: "=" },
    link: function(scope, elem) {
      var panelContainer = elem.find('.panel-container');
      var ctrl = scope.ctrl;
      scope.$watchGroup(['ctrl.fullscreen', 'ctrl.containerHeight'], function() {
        panelContainer.css({minHeight: ctrl.containerHeight});
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
      var lastPanel;
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
          } else if (lastPanel !== ctrl.panel) {
            // reduce width of last panel so total in row is 12
            lastPanel.span = lastPanel.span - (rowSpan - 12);
            lastPanel.span = Math.min(Math.max(lastPanel.span, 1), 12);
          }
        }

        scope.$apply(function() {
          ctrl.render();
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


