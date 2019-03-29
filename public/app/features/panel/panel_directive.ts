import angular from 'angular';
import $ from 'jquery';
import Drop from 'tether-drop';
import baron from 'baron';

const module = angular.module('grafana.directives');

const panelTemplate = `
  <div class="panel-container">
      <div class="panel-header" ng-class="{'grid-drag-handle': !ctrl.panel.fullscreen}">
        <span class="panel-info-corner">
          <i class="fa"></i>
          <span class="panel-info-corner-inner"></span>
        </span>

        <span class="panel-loading" ng-show="ctrl.loading">
          <i class="fa fa-spinner fa-spin"></i>
        </span>

        <panel-header class="panel-title-container" panel-ctrl="ctrl"></panel-header>
      </div>

      <div class="panel-content">
        <ng-transclude class="panel-height-helper"></ng-transclude>
      </div>
    </div>
  </div>
`;

module.directive('grafanaPanel', ($rootScope, $document, $timeout) => {
  return {
    restrict: 'E',
    template: panelTemplate,
    transclude: true,
    scope: { ctrl: '=' },
    link: (scope: any, elem) => {
      const panelContainer = elem.find('.panel-container');
      const panelContent = elem.find('.panel-content');
      const cornerInfoElem = elem.find('.panel-info-corner');
      const ctrl = scope.ctrl;
      let infoDrop;
      let panelScrollbar;

      // the reason for handling these classes this way is for performance
      // limit the watchers on panels etc
      let transparentLastState = false;
      let lastHasAlertRule = false;
      let lastAlertState;
      let hasAlertRule;

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
      ctrl.events.on('component-did-mount', () => {
        if (ctrl.__proto__.constructor.scrollable) {
          const scrollRootClass = 'baron baron__root baron__clipper panel-content--scrollable';
          const scrollerClass = 'baron__scroller';
          const scrollBarHTML = `
            <div class="baron__track">
              <div class="baron__bar"></div>
            </div>
          `;

          const scrollRoot = panelContent;
          const scroller = panelContent.find(':first').find(':first');

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

      ctrl.events.on('panel-size-changed', () => {
        ctrl.calculatePanelHeight(panelContainer[0].offsetHeight);
        $timeout(() => {
          resizeScrollableContent();
          ctrl.render();
        });
      });

      ctrl.events.on('view-mode-changed', () => {
        // first wait one pass for dashboard fullscreen view mode to take effect (classses being applied)
        setTimeout(() => {
          // then recalc style
          ctrl.calculatePanelHeight(panelContainer[0].offsetHeight);
          // then wait another cycle (this might not be needed)
          $timeout(() => {
            ctrl.render();
            resizeScrollableContent();
          });
        }, 10);
      });

      ctrl.events.on('render', () => {
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

          if (
            ctrl.alertState.state === 'ok' ||
            ctrl.alertState.state === 'alerting' ||
            ctrl.alertState.state === 'pending'
          ) {
            panelContainer.addClass('panel-alert-state--' + ctrl.alertState.state);
          }

          lastAlertState = ctrl.alertState.state;
        } else if (lastAlertState) {
          panelContainer.removeClass('panel-alert-state--' + lastAlertState);
          lastAlertState = null;
        }
      });

      function updatePanelCornerInfo() {
        const cornerMode = ctrl.getInfoMode();
        cornerInfoElem[0].className = 'panel-info-corner panel-info-corner--' + cornerMode;

        if (cornerMode) {
          if (infoDrop) {
            infoDrop.destroy();
          }

          infoDrop = new Drop({
            target: cornerInfoElem[0],
            content: () => {
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

      scope.$on('$destroy', () => {
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

module.directive('panelHelpCorner', $rootScope => {
  return {
    restrict: 'E',
    template: `
    <span class="alert-error panel-error small pointer" ng-if="ctrl.error" ng-click="ctrl.openInspector()">
    <span data-placement="top" bs-tooltip="ctrl.error">
    <i class="fa fa-exclamation"></i><span class="panel-error-arrow"></span>
    </span>
    </span>
    `,
    link: (scope, elem) => {},
  };
});
