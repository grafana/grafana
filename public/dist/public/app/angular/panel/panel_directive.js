// @ts-ignore
import baron from 'baron';
import { PanelEvents } from '@grafana/data';
import { Subscription } from 'rxjs';
import { PanelDirectiveReadyEvent, RenderEvent } from 'app/types/events';
import { coreModule } from 'app/core/core_module';
import { RefreshEvent } from '@grafana/runtime';
var panelTemplate = "\n  <ng-transclude class=\"panel-height-helper\"></ng-transclude>\n";
coreModule.directive('grafanaPanel', function ($rootScope, $document, $timeout) {
    return {
        restrict: 'E',
        template: panelTemplate,
        transclude: true,
        scope: { ctrl: '=' },
        link: function (scope, elem) {
            var ctrl = scope.ctrl;
            var panel = scope.ctrl.panel;
            var subs = new Subscription();
            var panelScrollbar;
            function resizeScrollableContent() {
                if (panelScrollbar) {
                    panelScrollbar.update();
                }
            }
            ctrl.events.on(PanelEvents.componentDidMount, function () {
                if (ctrl.__proto__.constructor.scrollable) {
                    var scrollRootClass = 'baron baron__root baron__clipper panel-content--scrollable';
                    var scrollerClass = 'baron__scroller';
                    var scrollBarHTML = "\n            <div class=\"baron__track\">\n              <div class=\"baron__bar\"></div>\n            </div>\n          ";
                    var scrollRoot = elem;
                    var scroller = elem.find(':first').find(':first');
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
            subs.add(panel.events.subscribe(RefreshEvent, function () {
                updateDimensionsFromParentScope();
                ctrl.events.emit('refresh');
            }));
            subs.add(panel.events.subscribe(RenderEvent, function (event) {
                var _a;
                // this event originated from angular so no need to bubble it back
                if ((_a = event.payload) === null || _a === void 0 ? void 0 : _a.fromAngular) {
                    return;
                }
                updateDimensionsFromParentScope();
                $timeout(function () {
                    resizeScrollableContent();
                    ctrl.events.emit('render');
                });
            }));
            subs.add(ctrl.events.subscribe(RenderEvent, function (event) {
                // this event originated from angular so bubble it to react so the PanelChromeAngular can update the panel header alert state
                if (event.payload) {
                    event.payload.fromAngular = true;
                    panel.events.publish(event);
                }
            }));
            scope.$on('$destroy', function () {
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
});
//# sourceMappingURL=panel_directive.js.map