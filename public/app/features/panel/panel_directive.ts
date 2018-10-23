import angular from 'angular';
import $ from 'jquery';
import Drop from 'tether-drop';
import baron from 'baron';

const module = angular.module('grafana.directives');

const panelTemplate = `
  <div ng-class="{'panel-editor-container': ctrl.panel.isEditing, 'panel-height-helper': !ctrl.panel.isEditing}">
    <div ng-class="{'panel-editor-container__panel': ctrl.panel.isEditing, 'panel-height-helper': !ctrl.panel.isEditing}">
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

    <div ng-if="ctrl.panel.isEditing" ng-class="{'panel-editor-container__editor': ctrl.panel.isEditing,
                                                 'panel-height-helper': !ctrl.panel.isEditing}">
      <div class="tabbed-view tabbed-view--new">
        <div class="tabbed-view-header">
          <h3 class="tabbed-view-panel-title">
            {{ctrl.pluginName}}
          </h3>

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
          <div ng-repeat="tab in ctrl.editorTabs" ng-if="ctrl.editorTabIndex === $index" class="panel-height-helper">
            <panel-editor-tab editor-tab="tab" ctrl="ctrl" index="$index"></panel-editor-tab>
          </div>
        </div>
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
    link: (scope, elem) => {
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
        panelContainer.addClass('panel-transparent', true);
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
        ctrl.calculatePanelHeight();
        $timeout(() => {
          resizeScrollableContent();
          ctrl.render();
        });
      });

      // set initial height
      ctrl.calculatePanelHeight();

      ctrl.events.on('render', () => {
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

          if (ctrl.alertState.state === 'ok' || ctrl.alertState.state === 'alerting') {
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

      cornerInfoElem.on('click', () => {
        infoDrop.close();
        scope.$apply(ctrl.openInspector.bind(ctrl));
      });

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
