import $ from 'jquery';
import _ from 'lodash';

import config from 'app/core/config';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { getExploreUrl } from 'app/core/utils/explore';

import Mousetrap from 'mousetrap';
import 'mousetrap-global-bind';

export class KeybindingSrv {
  helpModal: boolean;
  modalOpen = false;
  timepickerOpen = false;

  /** @ngInject */
  constructor(
    private $rootScope,
    private $location,
    private $timeout,
    private datasourceSrv,
    private timeSrv,
    private contextSrv
  ) {
    // clear out all shortcuts on route change
    $rootScope.$on('$routeChangeSuccess', () => {
      Mousetrap.reset();
      // rebind global shortcuts
      this.setupGlobal();
    });

    this.setupGlobal();
    appEvents.on('show-modal', () => (this.modalOpen = true));
    $rootScope.onAppEvent('timepickerOpen', () => (this.timepickerOpen = true));
    $rootScope.onAppEvent('timepickerClosed', () => (this.timepickerOpen = false));
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
    this.bindGlobal('esc', this.exit);
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

  exit() {
    const popups = $('.popover.in');
    if (popups.length > 0) {
      return;
    }

    appEvents.emit('hide-modal');

    if (this.modalOpen) {
      this.modalOpen = false;
      return;
    }

    if (this.timepickerOpen) {
      this.$rootScope.appEvent('closeTimepicker');
      this.timepickerOpen = false;
      return;
    }

    // close settings view
    const search = this.$location.search();
    if (search.editview) {
      delete search.editview;
      this.$location.search(search);
      return;
    }

    if (search.fullscreen) {
      this.$rootScope.appEvent('panel-change-view', { fullscreen: false, edit: false });
      return;
    }

    if (search.kiosk) {
      this.$rootScope.appEvent('toggle-kiosk-mode', { exit: true });
    }
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

  bindGlobal(keyArg, fn) {
    Mousetrap.bindGlobal(
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
    const search = _.extend(this.$location.search(), { editview: 'settings' });
    this.$location.search(search);
  }

  setupDashboardBindings(scope, dashboard) {
    this.bind('mod+o', () => {
      dashboard.graphTooltip = (dashboard.graphTooltip + 1) % 3;
      appEvents.emit('graph-hover-clear');
      dashboard.startRefresh();
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

    // jump to explore if permissions allow
    if (this.contextSrv.isEditor && config.exploreEnabled) {
      this.bind('x', async () => {
        if (dashboard.meta.focusPanelId) {
          const panel = dashboard.getPanelById(dashboard.meta.focusPanelId);
          const datasource = await this.datasourceSrv.get(panel.datasource);
          const url = await getExploreUrl(panel, panel.targets, datasource, this.datasourceSrv, this.timeSrv);
          if (url) {
            this.$timeout(() => this.$location.url(url));
          }
        }
      });
    }

    // delete panel
    this.bind('p r', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        this.$rootScope.appEvent('panel-remove', {
          panelId: dashboard.meta.focusPanelId,
        });
        dashboard.meta.focusPanelId = 0;
      }
    });

    // duplicate panel
    this.bind('p d', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        const panelIndex = dashboard.getPanelInfoById(dashboard.meta.focusPanelId).index;
        dashboard.duplicatePanel(dashboard.panels[panelIndex]);
      }
    });

    // share panel
    this.bind('p s', () => {
      if (dashboard.meta.focusPanelId) {
        const shareScope = scope.$new();
        const panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        shareScope.panel = panelInfo.panel;
        shareScope.dashboard = dashboard;

        appEvents.emit('show-modal', {
          src: 'public/app/features/dashboard/partials/shareModal.html',
          scope: shareScope,
        });
      }
    });

    // toggle panel legend
    this.bind('p l', () => {
      if (dashboard.meta.focusPanelId) {
        const panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        if (panelInfo.panel.legend) {
          const panelRef = dashboard.getPanelById(dashboard.meta.focusPanelId);
          panelRef.legend.show = !panelRef.legend.show;
          panelRef.refresh();
        }
      }
    });

    // collapse all rows
    this.bind('d shift+c', () => {
      dashboard.collapseRows();
    });

    // expand all rows
    this.bind('d shift+e', () => {
      dashboard.expandRows();
    });

    this.bind('d n', e => {
      this.$location.url('/dashboard/new');
    });

    this.bind('d r', () => {
      dashboard.startRefresh();
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

    //Autofit panels
    this.bind('d a', () => {
      // this has to be a full page reload
      window.location.href = window.location.href + '&autofitpanels';
    });
  }
}

coreModule.service('keybindingSrv', KeybindingSrv);
