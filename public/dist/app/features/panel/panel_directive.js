import angular from 'angular';
import $ from 'jquery';
import Drop from 'tether-drop';
import baron from 'baron';
var module = angular.module('grafana.directives');
var panelTemplate = "\n  <div class=\"panel-container\">\n      <div class=\"panel-header\" ng-class=\"{'grid-drag-handle': !ctrl.panel.fullscreen}\">\n        <span class=\"panel-info-corner\">\n          <i class=\"fa\"></i>\n          <span class=\"panel-info-corner-inner\"></span>\n        </span>\n\n        <span class=\"panel-loading\" ng-show=\"ctrl.loading\">\n          <i class=\"fa fa-spinner fa-spin\"></i>\n        </span>\n\n        <panel-header class=\"panel-title-container\" panel-ctrl=\"ctrl\"></panel-header>\n      </div>\n\n      <div class=\"panel-content\">\n        <ng-transclude class=\"panel-height-helper\"></ng-transclude>\n      </div>\n    </div>\n  </div>\n";
module.directive('grafanaPanel', function ($rootScope, $document, $timeout) {
    return {
        restrict: 'E',
        template: panelTemplate,
        transclude: true,
        scope: { ctrl: '=' },
        link: function (scope, elem) {
            var panelContainer = elem.find('.panel-container');
            var panelContent = elem.find('.panel-content');
            var cornerInfoElem = elem.find('.panel-info-corner');
            var ctrl = scope.ctrl;
            var infoDrop;
            var panelScrollbar;
            // the reason for handling these classes this way is for performance
            // limit the watchers on panels etc
            var transparentLastState = false;
            var lastHasAlertRule = false;
            var lastAlertState;
            var hasAlertRule;
            function mouseEnter() {
                panelContainer.toggleClass('panel-hover-highlight', true);
                ctrl.dashboard.setPanelFocus(ctrl.panel.id);
            }
            function mouseLeave() {
                panelContainer.toggleClass('panel-hover-highlight', false);
                ctrl.dashboard.setPanelFocus(0);
            }
            function resizeScrollableContent() {
                if (panelScrollbar) {
                    panelScrollbar.update();
                }
            }
            // set initial transparency
            if (ctrl.panel.transparent) {
                transparentLastState = true;
                panelContainer.addClass('panel-transparent');
            }
            // update scrollbar after mounting
            ctrl.events.on('component-did-mount', function () {
                if (ctrl.__proto__.constructor.scrollable) {
                    var scrollRootClass = 'baron baron__root baron__clipper panel-content--scrollable';
                    var scrollerClass = 'baron__scroller';
                    var scrollBarHTML = "\n            <div class=\"baron__track\">\n              <div class=\"baron__bar\"></div>\n            </div>\n          ";
                    var scrollRoot = panelContent;
                    var scroller = panelContent.find(':first').find(':first');
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
            ctrl.events.on('panel-size-changed', function () {
                ctrl.calculatePanelHeight(panelContainer[0].offsetHeight);
                $timeout(function () {
                    resizeScrollableContent();
                    ctrl.render();
                });
            });
            ctrl.events.on('view-mode-changed', function () {
                // first wait one pass for dashboard fullscreen view mode to take effect (classses being applied)
                setTimeout(function () {
                    // then recalc style
                    ctrl.calculatePanelHeight(panelContainer[0].offsetHeight);
                    // then wait another cycle (this might not be needed)
                    $timeout(function () {
                        ctrl.render();
                        resizeScrollableContent();
                    });
                }, 10);
            });
            ctrl.events.on('render', function () {
                // set initial height
                if (!ctrl.height) {
                    ctrl.calculatePanelHeight(panelContainer[0].offsetHeight);
                }
                if (transparentLastState !== ctrl.panel.transparent) {
                    panelContainer.toggleClass('panel-transparent', ctrl.panel.transparent === true);
                    transparentLastState = ctrl.panel.transparent;
                }
                hasAlertRule = ctrl.panel.alert !== undefined;
                if (lastHasAlertRule !== hasAlertRule) {
                    panelContainer.toggleClass('panel-has-alert', hasAlertRule);
                    lastHasAlertRule = hasAlertRule;
                }
                if (ctrl.alertState) {
                    if (lastAlertState) {
                        panelContainer.removeClass('panel-alert-state--' + lastAlertState);
                    }
                    if (ctrl.alertState.state === 'ok' ||
                        ctrl.alertState.state === 'alerting' ||
                        ctrl.alertState.state === 'pending') {
                        panelContainer.addClass('panel-alert-state--' + ctrl.alertState.state);
                    }
                    lastAlertState = ctrl.alertState.state;
                }
                else if (lastAlertState) {
                    panelContainer.removeClass('panel-alert-state--' + lastAlertState);
                    lastAlertState = null;
                }
            });
            function updatePanelCornerInfo() {
                var cornerMode = ctrl.getInfoMode();
                cornerInfoElem[0].className = 'panel-info-corner panel-info-corner--' + cornerMode;
                if (cornerMode) {
                    if (infoDrop) {
                        infoDrop.destroy();
                    }
                    infoDrop = new Drop({
                        target: cornerInfoElem[0],
                        content: function () {
                            return ctrl.getInfoContent({ mode: 'tooltip' });
                        },
                        classes: ctrl.error ? 'drop-error' : 'drop-help',
                        openOn: 'hover',
                        hoverOpenDelay: 100,
                        tetherOptions: {
                            attachment: 'bottom left',
                            targetAttachment: 'top left',
                            constraints: [
                                {
                                    to: 'window',
                                    attachment: 'together',
                                    pin: true,
                                },
                            ],
                        },
                    });
                }
            }
            scope.$watchGroup(['ctrl.error', 'ctrl.panel.description'], updatePanelCornerInfo);
            scope.$watchCollection('ctrl.panel.links', updatePanelCornerInfo);
            elem.on('mouseenter', mouseEnter);
            elem.on('mouseleave', mouseLeave);
            scope.$on('$destroy', function () {
                elem.off();
                cornerInfoElem.off();
                if (infoDrop) {
                    infoDrop.destroy();
                }
                if (panelScrollbar) {
                    panelScrollbar.dispose();
                }
            });
        },
    };
});
module.directive('panelHelpCorner', function ($rootScope) {
    return {
        restrict: 'E',
        template: "\n    <span class=\"alert-error panel-error small pointer\" ng-if=\"ctrl.error\" ng-click=\"ctrl.openInspector()\">\n    <span data-placement=\"top\" bs-tooltip=\"ctrl.error\">\n    <i class=\"fa fa-exclamation\"></i><span class=\"panel-error-arrow\"></span>\n    </span>\n    </span>\n    ",
        link: function (scope, elem) { },
    };
});
//# sourceMappingURL=panel_directive.js.map