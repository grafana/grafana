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
    this.bind('s o', this.openSearch);
    this.bind('s t', this.openSearchTags);
    this.bind('f', this.openSearch);
  }

  openSearchStarred() {
    this.$rootScope.appEvent('show-dash-search', {starred: true});
  }

  openSearchTags() {
    this.$rootScope.appEvent('show-dash-search', {tagsMode: true});
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
      evt.returnValue = false;
      return this.$rootScope.$apply(fn.bind(this));
    }, 'keydown');
  }

  showDashEditView(view) {
    var search = _.extend(this.$location.search(), {editview: view});
    this.$location.search(search);
  }

  setupDashboardBindings(scope, dashboard) {
    this.bind('mod+o', () => {
      dashboard.graphTooltip = (dashboard.graphTooltip + 1) % 3;
      appEvents.emit('graph-hover-clear');
      scope.broadcastRefresh();
    });

    this.bind('mod+h', () => {
      dashboard.hideControls = !dashboard.hideControls;
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
      this.$location.url("/dashboard/new");
    });

    this.bind('d r', () => {
      scope.broadcastRefresh();
    });

    this.bind('d s', () => {
      this.showDashEditView('settings');
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
      scope.appEvent('hide-dash-editor');
      scope.appEvent('panel-change-view', {fullscreen: false, edit: false});
    });

    var focusPanel = (pos) => {
      var rowIdx = pos.row;
      var panelIdx = pos.panel;
      if (dashboard.meta.focusPanelId) {
        this.$rootScope.appEvent('panel-toggle-highlight', {
          panelId: dashboard.meta.focusPanelId,
          toggle: false
        });
      }

      var row;
      if (dashboard.rows && dashboard.rows[rowIdx]) {
        row = dashboard.rows[rowIdx];
      }
      if (row && row.panels && row.panels[panelIdx]) {
        dashboard.meta.focusPanelId = row.panels[panelIdx].id;
      }

      this.$rootScope.appEvent('panel-toggle-highlight', {
        panelId: dashboard.meta.focusPanelId,
        toggle: true
      });
    };

    var getNextFocusPanelPosition = (key) => {
      if (!dashboard.meta.focusPanelId) {
        return { row: 0, panel: 0 };
      }

      var curRowIdx = _.findIndex(dashboard.rows, (row) => {
        return _.find(row.panels, (panel) => {
          return panel.id === dashboard.meta.focusPanelId;
        });
      });

      var rowIdx;
      switch (key) {
        case 'ctrl+k':
          rowIdx = Math.max(0, curRowIdx-1);
          break;
        case 'ctrl+j':
          rowIdx = Math.min(curRowIdx+1, dashboard.rows.length-1);
          break;
      }
      if (rowIdx) {
        return { row: rowIdx, panel: 0 };
      }

      var ids = dashboard.rows[curRowIdx].panels.map(panel => { return panel.id; });
      var curPanelIdx = _.indexOf(ids, dashboard.meta.focusPanelId);
      var panelIdx;
      switch (key) {
        case 'ctrl+h':
          panelIdx = Math.max(0, curPanelIdx-1);
          break;
        case 'ctrl+l':
          panelIdx = Math.min(curPanelIdx+1, ids.length-1);
          break;
      }
      if (panelIdx) {
        return { row: curRowIdx, panel: panelIdx };
      }

      return { row: 0, panel: 0 };
    };

    ['ctrl+h', 'ctrl+j', 'ctrl+k', 'ctrl+l'].forEach(key => {
      this.bind(key, () => {
        var pos = getNextFocusPanelPosition(key);
        focusPanel(pos);
      });
    });
  }
}

coreModule.service('keybindingSrv', KeybindingSrv);
