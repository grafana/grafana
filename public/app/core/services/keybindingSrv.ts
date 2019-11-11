import _ from 'lodash';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { getExploreUrl } from 'app/core/utils/explore';
import locationUtil from 'app/core/utils/location_util';
import { store } from 'app/store/store';
import { AppEventEmitter, CoreEvents } from 'app/types';

import Mousetrap from 'mousetrap';
import { PanelEvents } from '@grafana/data';
import 'mousetrap-global-bind';
import { ContextSrv } from './context_srv';
import { ILocationService, IRootScopeService, ITimeoutService } from 'angular';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { getLocationSrv } from '@grafana/runtime';

export class KeybindingSrv {
  helpModal: boolean;
  modalOpen = false;
  timepickerOpen = false;

  /** @ngInject */
  constructor(
    private $rootScope: GrafanaRootScope,
    private $location: ILocationService,
    private $timeout: ITimeoutService,
    private datasourceSrv: any,
    private timeSrv: any,
    private contextSrv: ContextSrv
  ) {
    // clear out all shortcuts on route change
    $rootScope.$on('$routeChangeSuccess', () => {
      Mousetrap.reset();
      // rebind global shortcuts
      this.setupGlobal();
    });

    this.setupGlobal();
    appEvents.on(CoreEvents.showModal, () => (this.modalOpen = true));
    appEvents.on(CoreEvents.timepickerOpen, () => (this.timepickerOpen = true));
    appEvents.on(CoreEvents.timepickerClosed, () => (this.timepickerOpen = false));
  }

  setupGlobal() {
    if (!(this.$location.path() === '/login')) {
      this.bind(['?', 'h'], this.showHelpModal);
      this.bind('g h', this.goToHome);
      this.bind('g a', this.openAlerting);
      this.bind('g p', this.goToProfile);
      this.bind('s o', this.openSearch);
      this.bind('f', this.openSearch);
      this.bind('esc', this.exit);
      this.bindGlobal('esc', this.globalEsc);
    }
  }

  globalEsc() {
    const anyDoc = document as any;
    const activeElement = anyDoc.activeElement;

    // typehead needs to handle it
    const typeaheads = document.querySelectorAll('.slate-typeahead--open');
    if (typeaheads.length > 0) {
      return;
    }

    // second check if we are in an input we can blur
    if (activeElement && activeElement.blur) {
      if (
        activeElement.nodeName === 'INPUT' ||
        activeElement.nodeName === 'TEXTAREA' ||
        activeElement.hasAttribute('data-slate-editor')
      ) {
        anyDoc.activeElement.blur();
        return;
      }
    }

    // ok no focused input or editor that should block this, let exist!
    this.exit();
  }

  openSearch() {
    appEvents.emit(CoreEvents.showDashSearch);
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
    appEvents.emit(CoreEvents.showModal, { templateHtml: '<help-modal></help-modal>' });
  }

  exit() {
    appEvents.emit(CoreEvents.hideModal);

    if (this.modalOpen) {
      this.modalOpen = false;
      return;
    }

    if (this.timepickerOpen) {
      this.$rootScope.appEvent(CoreEvents.closeTimepicker);
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
      appEvents.emit(PanelEvents.panelChangeView, { fullscreen: false, edit: false });
      return;
    }

    if (search.kiosk) {
      this.$rootScope.appEvent(CoreEvents.toggleKioskMode, { exit: true });
    }
  }

  bind(keyArg: string | string[], fn: () => void) {
    Mousetrap.bind(
      keyArg,
      (evt: any) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        return this.$rootScope.$apply(fn.bind(this));
      },
      'keydown'
    );
  }

  bindGlobal(keyArg: string, fn: () => void) {
    Mousetrap.bindGlobal(
      keyArg,
      (evt: any) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        return this.$rootScope.$apply(fn.bind(this));
      },
      'keydown'
    );
  }

  unbind(keyArg: string, keyType?: string) {
    Mousetrap.unbind(keyArg, keyType);
  }

  showDashEditView() {
    const search = _.extend(this.$location.search(), { editview: 'settings' });
    this.$location.search(search);
  }

  setupDashboardBindings(scope: IRootScopeService & AppEventEmitter, dashboard: any) {
    this.bind('mod+o', () => {
      dashboard.graphTooltip = (dashboard.graphTooltip + 1) % 3;
      appEvents.emit(CoreEvents.graphHoverClear);
      dashboard.startRefresh();
    });

    this.bind('mod+s', () => {
      scope.appEvent(CoreEvents.saveDashboard);
    });

    this.bind('t z', () => {
      scope.appEvent(CoreEvents.zoomOut, 2);
    });

    this.bind('ctrl+z', () => {
      scope.appEvent(CoreEvents.zoomOut, 2);
    });

    this.bind('t left', () => {
      scope.appEvent(CoreEvents.shiftTime, -1);
    });

    this.bind('t right', () => {
      scope.appEvent(CoreEvents.shiftTime, 1);
    });

    // edit panel
    this.bind('e', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        appEvents.emit(PanelEvents.panelChangeView, {
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
        appEvents.emit(PanelEvents.panelChangeView, {
          fullscreen: true,
          panelId: dashboard.meta.focusPanelId,
          toggle: true,
        });
      }
    });

    // jump to explore if permissions allow
    if (this.contextSrv.hasAccessToExplore()) {
      this.bind('x', async () => {
        if (dashboard.meta.focusPanelId) {
          const panel = dashboard.getPanelById(dashboard.meta.focusPanelId);
          const datasource = await this.datasourceSrv.get(panel.datasource);
          const url = await getExploreUrl({
            panel,
            panelTargets: panel.targets,
            panelDatasource: datasource,
            datasourceSrv: this.datasourceSrv,
            timeSrv: this.timeSrv,
          });
          const urlWithoutBase = locationUtil.stripBaseFromUrl(url);

          if (urlWithoutBase) {
            this.$timeout(() => this.$location.url(urlWithoutBase));
          }
        }
      });
    }

    // delete panel
    this.bind('p r', () => {
      if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
        appEvents.emit(CoreEvents.removePanel, dashboard.meta.focusPanelId);
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
        const shareScope: any = scope.$new();
        const panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        shareScope.panel = panelInfo.panel;
        shareScope.dashboard = dashboard;

        appEvents.emit(CoreEvents.showModal, {
          src: 'public/app/features/dashboard/components/ShareModal/template.html',
          scope: shareScope,
        });
      }
    });

    // inspect panel
    this.bind('p i', () => {
      if (dashboard.meta.focusPanelId) {
        getLocationSrv().update({ partial: true, query: { inspect: dashboard.meta.focusPanelId } });
      }
    });

    // toggle panel legend
    this.bind('p l', () => {
      if (dashboard.meta.focusPanelId) {
        const panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
        if (panelInfo.panel.legend) {
          const panelRef = dashboard.getPanelById(dashboard.meta.focusPanelId);
          panelRef.legend.show = !panelRef.legend.show;
          panelRef.render();
        }
      }
    });

    // toggle all panel legends
    this.bind('d l', () => {
      dashboard.toggleLegendsForAll();
    });

    // collapse all rows
    this.bind('d shift+c', () => {
      dashboard.collapseRows();
    });

    // expand all rows
    this.bind('d shift+e', () => {
      dashboard.expandRows();
    });

    this.bind('d n', () => {
      this.$location.url('/dashboard/new');
    });

    this.bind('d r', () => {
      dashboard.startRefresh();
    });

    this.bind('d s', () => {
      this.showDashEditView();
    });

    this.bind('d k', () => {
      appEvents.emit(CoreEvents.toggleKioskMode);
    });

    this.bind('d v', () => {
      appEvents.emit(CoreEvents.toggleViewMode);
    });

    //Autofit panels
    this.bind('d a', () => {
      // this has to be a full page reload
      const queryParams = store.getState().location.query;
      const newUrlParam = queryParams.autofitpanels ? '' : '&autofitpanels';
      window.location.href = window.location.href + newUrlParam;
    });
  }
}

coreModule.service('keybindingSrv', KeybindingSrv);

/**
 * Code below exports the service to react components
 */

let singletonInstance: KeybindingSrv;

export function setKeybindingSrv(instance: KeybindingSrv) {
  singletonInstance = instance;
}

export function getKeybindingSrv(): KeybindingSrv {
  return singletonInstance;
}
