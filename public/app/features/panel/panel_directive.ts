import angular from 'angular';
// import $ from 'jquery';
// @ts-ignore
// import baron from 'baron';
import { PanelEvents } from '@grafana/data';
// import { getLocationSrv } from '@grafana/runtime';
import { e2e } from '@grafana/e2e';

const module = angular.module('grafana.directives');

const panelTemplate = `
  <span class="panel-loading" ng-show="ctrl.loading">
    <i class="fa fa-spinner fa-spin"></i>
  </span>

  <ng-transclude class="panel-height-helper"></ng-transclude>
`;

module.directive('grafanaPanel', ($rootScope, $document, $timeout) => {
  return {
    restrict: 'E',
    template: panelTemplate,
    transclude: true,
    scope: { ctrl: '=' },
    link: (scope: any, elem) => {
      const ctrl = scope.ctrl;
      ctrl.selectors = e2e.pages.Dashboard.Panels.Panel.selectors;
      // let panelScrollbar: any;

      function resizeScrollableContent() {
        // if (panelScrollbar) {
        //   panelScrollbar.update();
        // }
      }

      // ctrl.events.on(PanelEvents.componentDidMount, () => {
      //   if (ctrl.__proto__.constructor.scrollable) {
      //     const scrollRootClass = 'baron baron__root baron__clipper panel-content--scrollable';
      //     const scrollerClass = 'baron__scroller';
      //     const scrollBarHTML = `
      //       <div class="baron__track">
      //         <div class="baron__bar"></div>
      //       </div>
      //     `;
      //
      //     const scrollRoot = panelContent;
      //     const scroller = panelContent.find(':first').find(':first');
      //
      //     scrollRoot.addClass(scrollRootClass);
      //     $(scrollBarHTML).appendTo(scrollRoot);
      //     scroller.addClass(scrollerClass);
      //
      //     panelScrollbar = baron({
      //       root: scrollRoot[0],
      //       scroller: scroller[0],
      //       bar: '.baron__bar',
      //       barOnCls: '_scrollbar',
      //       scrollingCls: '_scrolling',
      //     });
      //
      //     panelScrollbar.scroll();
      //   }
      // });

      ctrl.events.on(PanelEvents.panelSizeChanged, () => {
        ctrl.calculatePanelHeight(elem[0].offsetHeight);
        $timeout(() => {
          resizeScrollableContent();
          ctrl.render();
        });
      });

      ctrl.events.on(PanelEvents.viewModeChanged, () => {
        // first wait one pass for dashboard fullscreen view mode to take effect (classses being applied)
        setTimeout(() => {
          // then recalc style
          ctrl.calculatePanelHeight(elem[0].offsetHeight);
          // then wait another cycle (this might not be needed)
          $timeout(() => {
            ctrl.render();
            resizeScrollableContent();
          });
        }, 10);
      });

      ctrl.events.on(PanelEvents.render, () => {});

      scope.$on('$destroy', () => {
        elem.off();
      });
    },
  };
});
