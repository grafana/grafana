import angular from 'angular';
// @ts-ignore
import baron from 'baron';
import { PanelEvents } from '@grafana/data';
import { PanelModel } from '../dashboard/state';
import { PanelCtrl } from './panel_ctrl';

const module = angular.module('grafana.directives');

const panelTemplate = `
  <ng-transclude class="panel-height-helper"></ng-transclude>
`;

module.directive('grafanaPanel', ($rootScope, $document, $timeout) => {
  return {
    restrict: 'E',
    template: panelTemplate,
    transclude: true,
    scope: { ctrl: '=' },
    link: (scope: any, elem) => {
      const ctrl: PanelCtrl = scope.ctrl;
      const panel: PanelModel = scope.ctrl.panel;

      let panelScrollbar: any;

      function resizeScrollableContent() {
        if (panelScrollbar) {
          panelScrollbar.update();
        }
      }

      ctrl.events.on(PanelEvents.componentDidMount, () => {
        if ((ctrl as any).__proto__.constructor.scrollable) {
          const scrollRootClass = 'baron baron__root baron__clipper panel-content--scrollable';
          const scrollerClass = 'baron__scroller';
          const scrollBarHTML = `
            <div class="baron__track">
              <div class="baron__bar"></div>
            </div>
          `;

          const scrollRoot = elem;
          const scroller = elem.find(':first').find(':first');

          scrollRoot.addClass(scrollRootClass);
          $(scrollBarHTML).appendTo(scrollRoot);
          scroller.addClass(scrollerClass);

          panelScrollbar = baron({
            root: scrollRoot[0],
            scroller: scroller[0],
            bar: '.baron__bar',
            barOnCls: '_scrollbar',
            scrollingCls: '_scrolling',
          });

          panelScrollbar.scroll();
        }
      });

      function onPanelSizeChanged() {
        $timeout(() => {
          resizeScrollableContent();
          ctrl.render();
        });
      }

      function onViewModeChanged() {
        // first wait one pass for dashboard fullscreen view mode to take effect (classses being applied)
        setTimeout(() => {
          // then wait another cycle (this might not be needed)
          $timeout(() => {
            ctrl.render();
            resizeScrollableContent();
          });
        }, 10);
      }

      function onPanelModelRender(payload?: any) {
        ctrl.height = scope.$parent.$parent.size.height;
        ctrl.width = scope.$parent.$parent.size.width;
      }

      function onPanelModelRefresh() {
        ctrl.height = scope.$parent.$parent.size.height;
        ctrl.width = scope.$parent.$parent.size.width;
      }

      panel.events.on(PanelEvents.refresh, onPanelModelRefresh);
      panel.events.on(PanelEvents.render, onPanelModelRender);
      panel.events.on(PanelEvents.panelSizeChanged, onPanelSizeChanged);
      panel.events.on(PanelEvents.viewModeChanged, onViewModeChanged);

      scope.$on('$destroy', () => {
        elem.off();

        panel.events.emit(PanelEvents.panelTeardown);
        panel.events.removeAllListeners();

        if (panelScrollbar) {
          panelScrollbar.dispose();
        }
      });
    },
  };
});
