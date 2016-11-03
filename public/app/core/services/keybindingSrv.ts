///<reference path="../../headers/common.d.ts" />

import $ from 'jquery';
import _ from 'lodash';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

import Mousetrap from 'mousetrap';

export class KeybindingSrv {
  helpModal: boolean;

  /** @ngInject */
  constructor(
    private $rootScope,
    private $modal,
    private $location,
    private contextSrv,
    private $timeout) {

    // clear out all shortcuts on route change
    $rootScope.$on('$routeChangeSuccess', () => {
      Mousetrap.reset();
      // rebind global shortcuts
      this.setupGlobal();
    });

    this.setupGlobal();
  }

  setupGlobal() {
    this.bind(['?', 'h'], this.showHelpModal);
    this.bind("g h", this.goToHome);
    this.bind("g a", this.openAlerting);
    this.bind("g p", this.goToProfile);
    this.bind("s s", this.openSearchStarred);
    this.bind('f', this.openSearch);
  }

  openSearchStarred() {
    this.$rootScope.appEvent('show-dash-search', {starred: true});
  }

  openSearch() {
    this.$rootScope.appEvent('show-dash-search');
  }

  openAlerting() {
    this.$location.url("/alerting");
  }

  goToHome() {
    this.$location.url("/");
  }

  goToProfile() {
    this.$location.url("/profile");
  }

  showHelpModal() {
    appEvents.emit('show-modal', {templateHtml: '<help-modal></help-modal>'});
  }

  bind(keyArg, fn) {
    Mousetrap.bind(keyArg, evt => {
      evt.preventDefault();
      evt.stopPropagation();
      return this.$rootScope.$apply(fn.bind(this));
    });
  }

  showDashEditView(view) {
    var search = _.extend(this.$location.search(), {editview: view});
    this.$location.search(search);
  }

  setupDashboardBindings(scope, dashboard) {
    // this.bind('b', () => {
    //   dashboard.toggleEditMode();
    // });

    this.bind('ctrl+o', () => {
      dashboard.sharedCrosshair = !dashboard.sharedCrosshair;
      scope.broadcastRefresh();
    });

    this.bind(['ctrl+s', 'command+s'], () => {
      scope.appEvent('save-dashboard');
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

    // edit panel
    this.bind('e', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        this.$rootScope.appEvent('panel-change-view', {
          fullscreen: true,
          edit: true,
          panelId: dashboard.meta.focusPanelId,
          toggle: true
        });
      }
    });

    // view panel
    this.bind('v', () => {
      if (dashboard.meta.focusPanelId) {
        this.$rootScope.appEvent('panel-change-view', {
          fullscreen: true,
          edit: null,
          panelId: dashboard.meta.focusPanelId,
          toggle: true,
        });
      }
    });

    // delete panel
    this.bind('r', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        var panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        panelInfo.row.removePanel(panelInfo.panel);
        dashboard.meta.focusPanelId = 0;
      }
    });

    // delete panel
    this.bind('s', () => {
      if (dashboard.meta.focusPanelId) {
        var shareScope =  scope.$new();
        var panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        shareScope.panel = panelInfo.panel;
        shareScope.dashboard = dashboard;

        appEvents.emit('show-modal', {
          src: 'public/app/features/dashboard/partials/shareModal.html',
          scope: shareScope
        });
      }
    });

    this.bind('d r', () => {
      scope.broadcastRefresh();
    });

    this.bind('d s', () => {
      this.showDashEditView('settings');
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
