// Libraries
import _ from 'lodash';
import $ from 'jquery';
// @ts-ignore
import Drop from 'tether-drop';

// Utils and servies
import { colors } from '@grafana/ui';
import { setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import config from 'app/core/config';
import coreModule from 'app/core/core_module';
import { profiler } from 'app/core/profiler';
import appEvents from 'app/core/app_events';
import { TimeSrv, setTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { KeybindingSrv, setKeybindingSrv } from 'app/core/services/keybindingSrv';
import { AngularLoader, setAngularLoader } from 'app/core/services/AngularLoader';
import { configureStore } from 'app/store/configureStore';

import { LocationUpdate, setLocationSrv } from '@grafana/runtime';
import { updateLocation } from 'app/core/actions';

// Types
import { KioskUrlValue, CoreEvents, AppEventEmitter, AppEventConsumer } from 'app/types';
import { setLinkSrv, LinkSrv } from 'app/features/panel/panellinks/link_srv';
import { UtilSrv } from 'app/core/services/util_srv';
import { ContextSrv } from 'app/core/services/context_srv';
import { BridgeSrv } from 'app/core/services/bridge_srv';
import { PlaylistSrv } from 'app/features/playlist/playlist_srv';
import { DashboardSrv, setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { ILocationService, ITimeoutService, IRootScopeService, IAngularEvent } from 'angular';
import { AppEvent, AppEvents } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';

export type GrafanaRootScope = IRootScopeService & AppEventEmitter & AppEventConsumer & { colors: string[] };

export class GrafanaCtrl {
  /** @ngInject */
  constructor(
    $scope: any,
    utilSrv: UtilSrv,
    $rootScope: GrafanaRootScope,
    contextSrv: ContextSrv,
    bridgeSrv: BridgeSrv,
    timeSrv: TimeSrv,
    linkSrv: LinkSrv,
    datasourceSrv: DatasourceSrv,
    keybindingSrv: KeybindingSrv,
    dashboardSrv: DashboardSrv,
    angularLoader: AngularLoader
  ) {
    // make angular loader service available to react components
    setAngularLoader(angularLoader);
    setBackendSrv(backendSrv);
    setDataSourceSrv(datasourceSrv);
    setTimeSrv(timeSrv);
    setLinkSrv(linkSrv);
    setKeybindingSrv(keybindingSrv);
    setDashboardSrv(dashboardSrv);

    const store = configureStore();
    setLocationSrv({
      update: (opt: LocationUpdate) => {
        store.dispatch(updateLocation(opt));
      },
    });

    $scope.init = () => {
      $scope.contextSrv = contextSrv;
      $scope.appSubUrl = config.appSubUrl;
      $scope._ = _;

      profiler.init(config, $rootScope);
      utilSrv.init();
      bridgeSrv.init();
    };

    $rootScope.colors = colors;

    $rootScope.onAppEvent = function<T>(
      event: AppEvent<T> | string,
      callback: (event: IAngularEvent, ...args: any[]) => void,
      localScope?: any
    ) {
      let unbind;
      if (typeof event === 'string') {
        unbind = $rootScope.$on(event, callback);
      } else {
        unbind = $rootScope.$on(event.name, callback);
      }

      let callerScope = this;
      if (callerScope.$id === 1 && !localScope) {
        console.log('warning rootScope onAppEvent called without localscope');
      }
      if (localScope) {
        callerScope = localScope;
      }
      callerScope.$on('$destroy', unbind);
    };

    $rootScope.appEvent = <T>(event: AppEvent<T> | string, payload?: T | any) => {
      if (typeof event === 'string') {
        $rootScope.$emit(event, payload);
        appEvents.emit(event, payload);
      } else {
        $rootScope.$emit(event.name, payload);
        appEvents.emit(event, payload);
      }
    };

    $scope.init();
  }
}

function setViewModeBodyClass(body: JQuery, mode: KioskUrlValue) {
  body.removeClass('view-mode--tv');
  body.removeClass('view-mode--kiosk');
  body.removeClass('view-mode--inactive');

  switch (mode) {
    case 'tv': {
      body.addClass('view-mode--tv');
      break;
    }
    // 1 & true for legacy states
    case '1':
    case true: {
      body.addClass('view-mode--kiosk');
      break;
    }
  }
}

/** @ngInject */
export function grafanaAppDirective(
  playlistSrv: PlaylistSrv,
  contextSrv: ContextSrv,
  $timeout: ITimeoutService,
  $rootScope: IRootScopeService,
  $location: ILocationService
) {
  return {
    restrict: 'E',
    controller: GrafanaCtrl,
    link: (scope: IRootScopeService & AppEventEmitter, elem: JQuery) => {
      const body = $('body');
      // see https://github.com/zenorocha/clipboard.js/issues/155
      $.fn.modal.Constructor.prototype.enforceFocus = () => {};

      $('.preloader').remove();

      appEvents.on(CoreEvents.toggleSidemenuMobile, () => {
        body.toggleClass('sidemenu-open--xs');
      });

      appEvents.on(CoreEvents.toggleSidemenuHidden, () => {
        body.toggleClass('sidemenu-hidden');
      });

      appEvents.on(CoreEvents.playlistStarted, () => {
        elem.toggleClass('view-mode--playlist', true);
      });

      appEvents.on(CoreEvents.playlistStopped, () => {
        elem.toggleClass('view-mode--playlist', false);
      });

      // check if we are in server side render
      if (config.phantomJSRenderer && document.cookie.indexOf('renderKey') !== -1) {
        body.addClass('body--phantomjs');
      }

      // tooltip removal fix
      // manage page classes
      let pageClass: string;
      scope.$on('$routeChangeSuccess', (evt: any, data: any) => {
        if (pageClass) {
          body.removeClass(pageClass);
        }

        if (data.$$route) {
          pageClass = data.$$route.pageClass;
          if (pageClass) {
            body.addClass(pageClass);
          }
        }

        // clear body class sidemenu states
        body.removeClass('sidemenu-open--xs');

        $('#tooltip, .tooltip').remove();

        // check for kiosk url param
        setViewModeBodyClass(body, data.params.kiosk);

        // close all drops
        for (const drop of Drop.drops) {
          drop.destroy();
        }

        appEvents.emit(CoreEvents.hideDashSearch);
      });

      // handle kiosk mode
      appEvents.on(CoreEvents.toggleKioskMode, (options: { exit?: boolean }) => {
        const search: { kiosk?: KioskUrlValue } = $location.search();

        if (options && options.exit) {
          search.kiosk = '1';
        }

        switch (search.kiosk) {
          case 'tv': {
            search.kiosk = true;
            appEvents.emit(AppEvents.alertSuccess, ['Press ESC to exit Kiosk mode']);
            break;
          }
          case '1':
          case true: {
            delete search.kiosk;
            break;
          }
          default: {
            search.kiosk = 'tv';
          }
        }

        $timeout(() => $location.search(search));
        setViewModeBodyClass(body, search.kiosk!);
      });

      // handle in active view state class
      let lastActivity = new Date().getTime();
      let activeUser = true;
      const inActiveTimeLimit = 60 * 5000;

      function checkForInActiveUser() {
        if (!activeUser) {
          return;
        }
        // only go to activity low mode on dashboard page
        if (!body.hasClass('page-dashboard')) {
          return;
        }

        if (new Date().getTime() - lastActivity > inActiveTimeLimit) {
          activeUser = false;
          body.addClass('view-mode--inactive');
        }
      }

      function userActivityDetected() {
        lastActivity = new Date().getTime();
        if (!activeUser) {
          activeUser = true;
          body.removeClass('view-mode--inactive');
        }
      }

      // mouse and keyboard is user activity
      body.mousemove(userActivityDetected);
      body.keydown(userActivityDetected);
      // set useCapture = true to catch event here
      document.addEventListener('wheel', userActivityDetected, { capture: true, passive: true });
      // treat tab change as activity
      document.addEventListener('visibilitychange', userActivityDetected);

      // check every 2 seconds
      setInterval(checkForInActiveUser, 2000);

      appEvents.on(CoreEvents.toggleViewMode, () => {
        lastActivity = 0;
        checkForInActiveUser();
      });

      // handle document clicks that should hide things
      body.click(evt => {
        const target = $(evt.target);
        if (target.parents().length === 0) {
          return;
        }

        // ensure dropdown menu doesn't impact on z-index
        body.find('.dropdown-menu-open').removeClass('dropdown-menu-open');

        // for stuff that animates, slides out etc, clicking it needs to
        // hide it right away
        const clickAutoHide = target.closest('[data-click-hide]');
        if (clickAutoHide.length) {
          const clickAutoHideParent = clickAutoHide.parent();
          clickAutoHide.detach();
          setTimeout(() => {
            clickAutoHideParent.append(clickAutoHide);
          }, 100);
        }

        // hide search
        if (body.find('.search-container').length > 0) {
          if (target.parents('.search-results-container, .search-field-wrapper').length === 0) {
            scope.$apply(() => {
              scope.appEvent(CoreEvents.hideDashSearch);
            });
          }
        }

        // hide popovers
        const popover = elem.find('.popover');
        if (popover.length > 0 && target.parents('.graph-legend').length === 0) {
          popover.hide();
        }
      });
    },
  };
}

coreModule.directive('grafanaApp', grafanaAppDirective);
