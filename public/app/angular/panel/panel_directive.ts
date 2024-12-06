// @ts-ignore
import baron from 'baron';
import { Subscription } from 'rxjs';

import { PanelEvents } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { coreModule } from 'app/angular/core_module';
import { PanelDirectiveReadyEvent, RenderEvent } from 'app/types/events';

import { PanelModel } from '../../features/dashboard/state/PanelModel';

import { PanelCtrl } from './panel_ctrl';

const panelTemplate = `
  <ng-transclude class="panel-height-helper"></ng-transclude>
`;

coreModule.directive('grafanaPanel', [
  '$timeout',
  ($timeout) => {
    return {
      restrict: 'E',
      template: panelTemplate,
      transclude: true,
      scope: { ctrl: '=' },
      link: (scope: any, elem) => {
        const ctrl: PanelCtrl = scope.ctrl;
        const panel: PanelModel = scope.ctrl.panel;
        const subs = new Subscription();

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

        function updateDimensionsFromParentScope() {
          ctrl.height = scope.$parent.$parent.size.height;
          ctrl.width = scope.$parent.$parent.size.width;
        }

        updateDimensionsFromParentScope();

        // Pass PanelModel events down to angular controller event emitter
        subs.add(
          panel.events.subscribe(RefreshEvent, () => {
            updateDimensionsFromParentScope();
            ctrl.events.emit('refresh');
          })
        );

        subs.add(
          panel.events.subscribe(RenderEvent, (event) => {
            // this event originated from angular so no need to bubble it back
            if (event.payload?.fromAngular) {
              return;
            }

            updateDimensionsFromParentScope();

            $timeout(() => {
              resizeScrollableContent();
              ctrl.events.emit('render');
            });
          })
        );

        subs.add(
          ctrl.events.subscribe(RenderEvent, (event) => {
            // this event originated from angular so bubble it to react so the PanelChromeAngular can update the panel header alert state
            if (event.payload) {
              event.payload.fromAngular = true;
              panel.events.publish(event);
            }
          })
        );

        scope.$on('$destroy', () => {
          elem.off();

          // Remove PanelModel.event subs
          subs.unsubscribe();
          // Remove Angular controller event subs
          ctrl.events.emit(PanelEvents.panelTeardown);
          ctrl.events.removeAllListeners();

          if (panelScrollbar) {
            panelScrollbar.dispose();
          }
        });

        panel.events.publish(PanelDirectiveReadyEvent);
      },
    };
  },
]);
