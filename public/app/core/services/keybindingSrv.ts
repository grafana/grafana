import $ from 'jquery';
import _ from 'lodash';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

import Mousetrap from 'mousetrap';

export class KeybindingSrv {
  helpModal: boolean;

  /** @ngInject */
  constructor(private $rootScope, private $location) {
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
    this.bind('g h', this.goToHome);
    this.bind('g a', this.openAlerting);
    this.bind('g p', this.goToProfile);
    this.bind('s s', this.openSearchStarred);
    this.bind('s o', this.openSearch);
    this.bind('s t', this.openSearchTags);
    this.bind('f', this.openSearch);
  }

  openSearchStarred() {
    appEvents.emit('show-dash-search', { starred: true });
  }

  openSearchTags() {
    appEvents.emit('show-dash-search', { tagsMode: true });
  }

  openSearch() {
    appEvents.emit('show-dash-search');
  }

  openAlerting() {
    this.$location.url('/alerting');
  }

  goToHome() {
    this.$location.url('/');
  }

  goToProfile() {
    this.$location.url('/profile');
  }

  showHelpModal() {
    appEvents.emit('show-modal', { templateHtml: '<help-modal></help-modal>' });
  }

  bind(keyArg, fn) {
    Mousetrap.bind(
      keyArg,
      evt => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        return this.$rootScope.$apply(fn.bind(this));
      },
      'keydown'
    );
  }

  showDashEditView() {
    var search = _.extend(this.$location.search(), { editview: 'settings' });
    this.$location.search(search);
  }

  setupDashboardBindings(scope, dashboard) {
    this.bind('mod+o', () => {
      dashboard.graphTooltip = (dashboard.graphTooltip + 1) % 3;
      appEvents.emit('graph-hover-clear');
      this.$rootScope.$broadcast('refresh');
    });

    this.bind('mod+s', e => {
      scope.appEvent('save-dashboard');
    });

    this.bind('t z', () => {
      scope.appEvent('zoom-out', 2);
    });

    this.bind('ctrl+z', () => {
      scope.appEvent('zoom-out', 2);
    });

    this.bind('t left', () => {
      scope.appEvent('shift-time-backward');
    });

    this.bind('t right', () => {
      scope.appEvent('shift-time-forward');
    });

    // edit panel
    this.bind('e', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        this.$rootScope.appEvent('panel-change-view', {
          fullscreen: true,
          edit: true,
          panelId: dashboard.meta.focusPanelId,
          toggle: true,
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
    this.bind('p r', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        var panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        panelInfo.row.removePanel(panelInfo.panel);
        dashboard.meta.focusPanelId = 0;
      }
    });

    // share panel
    this.bind('p s', () => {
      if (dashboard.meta.focusPanelId) {
        var shareScope = scope.$new();
        var panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        shareScope.panel = panelInfo.panel;
        shareScope.dashboard = dashboard;

        appEvents.emit('show-modal', {
          src: 'public/app/features/dashboard/partials/shareModal.html',
          scope: shareScope,
        });
      }
    });

    // delete row
    this.bind('r r', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        var panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        dashboard.removeRow(panelInfo.row);
        dashboard.meta.focusPanelId = 0;
      }
    });

    // collapse row
    this.bind('r c', () => {
      if (dashboard.meta.focusPanelId) {
        var panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        panelInfo.row.toggleCollapse();
        dashboard.meta.focusPanelId = 0;
      }
    });

    // collapse all rows
    this.bind('d shift+c', () => {
      for (let row of dashboard.rows) {
        row.collapse = true;
      }
    });

    // expand all rows
    this.bind('d shift+e', () => {
      for (let row of dashboard.rows) {
        row.collapse = false;
      }
    });

    this.bind('d n', e => {
      this.$location.url('/dashboard/new');
    });

    this.bind('d r', () => {
      this.$rootScope.$broadcast('refresh');
    });

    this.bind('d s', () => {
      this.showDashEditView();
    });

    this.bind('d k', () => {
      appEvents.emit('toggle-kiosk-mode');
    });

    this.bind('d v', () => {
      appEvents.emit('toggle-view-mode');
    });

    this.bind('esc', () => {
      var popups = $('.popover.in');
      if (popups.length > 0) {
        return;
      }

      scope.appEvent('hide-modal');
      scope.appEvent('panel-change-view', { fullscreen: false, edit: false });

      // close settings view
      var search = this.$location.search();
      if (search.editview) {
        delete search.editview;
        this.$location.search(search);
      }
    });
  }
}

coreModule.service('keybindingSrv', KeybindingSrv);
