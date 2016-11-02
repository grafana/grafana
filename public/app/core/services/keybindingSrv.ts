///<reference path="../../headers/common.d.ts" />

import $ from 'jquery';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

import Mousetrap from 'mousetrap';

export class KeybindingSrv {
  helpModal: boolean;

  /** @ngInject */
  constructor(private $rootScope, private $modal, private $location) {
    // clear out all shortcuts on route change
    $rootScope.$on('$routeChangeSuccess', () => {
      Mousetrap.reset();
      // rebind global shortcuts
      this.setupGlobal();
    });

    this.setupGlobal();
  }


  setupGlobal() {
    this.bind("?", this.showHelpModal);
    this.bind("g h", this.goToHome);
    this.bind("g p", this.goToProfile);
    this.bind("s s", this.openSearchStarred);
    this.bind(['f'], this.openSearch);
  }

  openSearchStarred() {
    this.$rootScope.appEvent('show-dash-search', {starred: true});
  }

  openSearch() {
    this.$rootScope.appEvent('show-dash-search');
  }

  goToHome() {
    this.$location.path("/");
  }

  goToProfile() {
    this.$location.path("/profile");
  }

  showHelpModal() {
    console.log('showing help modal');
    appEvents.emit('show-modal', {
      src: 'public/app/partials/help_modal.html',
      model: {}
    });
  }

  bind(keyArg, fn) {
    Mousetrap.bind(keyArg, evt => {
      evt.preventDefault();
      evt.stopPropagation();
      return this.$rootScope.$apply(fn.bind(this));
    });
  }

  setupDashboardBindings(scope, dashboard) {
    this.bind('b', () => {
      dashboard.toggleEditMode();
    });

    this.bind('ctrl+o', () => {
      dashboard.sharedCrosshair = !dashboard.sharedCrosshair;
      scope.broadcastRefresh();
    });

    this.bind(['ctrl+s', 'command+s'], () => {
      scope.appEvent('save-dashboard');
    });

    this.bind('r', () => {
      scope.broadcastRefresh();
    });

    this.bind('ctrl+z', () => {
      scope.appEvent('zoom-out');
    });

    this.bind('left', () => {
      scope.appEvent('shift-time-backward');
    });

    this.bind('right', () => {
      scope.appEvent('shift-time-forward');
    });

    this.bind('ctrl+i', () => {
      scope.appEvent('quick-snapshot');
    });

    this.bind('e', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        this.$rootScope.appEvent('panel-change-view', {
          fullscreen: true, edit: true, panelId: dashboard.meta.focusPanelId
        });
      }
    });

    this.bind('v', () => {
      if (dashboard.meta.focusPanelId) {
        this.$rootScope.appEvent('panel-change-view', {
          fullscreen: true, edit: null, panelId: dashboard.meta.focusPanelId
        });
      }
    });

    this.bind('d', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        var panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        panelInfo.row.removePanel(panelInfo.panel);
        dashboard.meta.focusPanelId = 0;
      }
    });

    this.bind('esc', () => {
      var popups = $('.popover.in');
      if (popups.length > 0) {
        return;
      }
      // close modals
      var modalData = $(".modal").data();
      if (modalData && modalData.$scope && modalData.$scope.dismiss) {
        modalData.$scope.dismiss();
      }

      scope.appEvent('hide-dash-editor');
      scope.exitFullscreen();
    });
  }
}

coreModule.service('keybindingSrv', KeybindingSrv);
