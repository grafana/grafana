import Mousetrap from 'mousetrap';
import 'mousetrap-global-bind';
import { IRootScopeService } from 'angular';
import { LegacyGraphHoverClearEvent, locationUtil } from '@grafana/data';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { getExploreUrl } from 'app/core/utils/explore';
import { store } from 'app/store/store';
import { AppEventEmitter } from 'app/types';
import { DashboardModel } from 'app/features/dashboard/state';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { SaveDashboardModalProxy } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardModalProxy';
import { locationService } from '@grafana/runtime';
import { exitKioskMode, toggleKioskMode } from '../navigation/kiosk';
import {
  HideModalEvent,
  RemovePanelEvent,
  ShiftTimeEvent,
  ShiftTimeEventPayload,
  ShowModalEvent,
  ShowModalReactEvent,
  ZoomOutEvent,
} from '../../types/events';
import { contextSrv } from '../core';
import { getDatasourceSrv } from '../../features/plugins/datasource_srv';
import { getTimeSrv } from '../../features/dashboard/services/TimeSrv';

export class KeybindingSrv {
  modalOpen = false;
  constructor() {
    this.setupGlobal();
    appEvents.subscribe(ShowModalEvent, () => (this.modalOpen = true));
  }

  setupGlobal() {
    Mousetrap.reset();
    if (locationService.getLocation().pathname !== '/login') {
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
    locationService.partial({ search: 'open' });
  }

  closeSearch() {
    locationService.partial({ search: null });
  }

  openAlerting() {
    locationService.push('/alerting');
  }

  goToHome() {
    locationService.push('/');
  }

  goToProfile() {
    locationService.push('/profile');
  }

  showHelpModal() {
    appEvents.publish(new ShowModalEvent({ templateHtml: '<help-modal></help-modal>' }));
  }

  exit() {
    appEvents.publish(new HideModalEvent());

    if (this.modalOpen) {
      this.modalOpen = false;
      return;
    }

    const search = locationService.getSearch();

    if (search.get('editview')) {
      locationService.partial({ editview: null });
      return;
    }

    if (search.get('inspect')) {
      locationService.partial({ inspect: null, inspectTab: null });
      return;
    }

    if (search.get('editPanel')) {
      locationService.partial({ editPanel: null, tab: null });
      return;
    }

    if (search.get('viewPanel')) {
      locationService.partial({ viewPanel: null, tab: null });
      return;
    }

    if (search.get('kiosk')) {
      exitKioskMode();
    }

    if (search.get('search')) {
      this.closeSearch();
    }
  }

  bind(keyArg: string | string[], fn: () => void) {
    Mousetrap.bind(
      keyArg,
      (evt: any) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        fn.call(this);
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
        fn.call(this);
      },
      'keydown'
    );
  }

  unbind(keyArg: string, keyType?: string) {
    Mousetrap.unbind(keyArg, keyType);
  }

  showDashEditView() {
    locationService.partial({
      editview: 'settings',
    });
  }

  setupDashboardBindings(scope: IRootScopeService & AppEventEmitter, dashboard: DashboardModel) {
    this.bind('mod+o', () => {
      dashboard.graphTooltip = (dashboard.graphTooltip + 1) % 3;
      dashboard.events.publish(new LegacyGraphHoverClearEvent());
      dashboard.startRefresh();
    });

    this.bind('mod+s', () => {
      appEvents.publish(
        new ShowModalReactEvent({
          component: SaveDashboardModalProxy,
          props: {
            dashboard,
          },
        })
      );
    });

    this.bind('t z', () => {
      appEvents.publish(new ZoomOutEvent(2));
    });

    this.bind('ctrl+z', () => {
      appEvents.publish(new ZoomOutEvent(2));
    });

    this.bind('t left', () => {
      appEvents.publish(new ShiftTimeEvent(ShiftTimeEventPayload.Left));
    });

    this.bind('t right', () => {
      appEvents.publish(new ShiftTimeEvent(ShiftTimeEventPayload.Right));
    });

    // edit panel
    this.bind('e', () => {
      if (!dashboard.meta.focusPanelId) {
        return;
      }

      if (dashboard.canEditPanelById(dashboard.meta.focusPanelId)) {
        locationService.partial({
          editPanel: dashboard.meta.focusPanelId,
        });
      }
    });

    // view panel
    this.bind('v', () => {
      if (dashboard.meta.focusPanelId) {
        locationService.partial({
          viewPanel: dashboard.meta.focusPanelId,
        });
      }
    });

    this.bind('i', () => {
      if (dashboard.meta.focusPanelId) {
        locationService.partial({
          inspect: dashboard.meta.focusPanelId,
        });
      }
    });

    // jump to explore if permissions allow
    if (contextSrv.hasAccessToExplore()) {
      this.bind('x', async () => {
        if (dashboard.meta.focusPanelId) {
          const panel = dashboard.getPanelById(dashboard.meta.focusPanelId)!;
          const datasource = await getDatasourceSrv().get(panel.datasource);
          const url = await getExploreUrl({
            panel,
            panelTargets: panel.targets,
            panelDatasource: datasource,
            datasourceSrv: getDatasourceSrv(),
            timeSrv: getTimeSrv(),
          });

          if (url) {
            const urlWithoutBase = locationUtil.stripBaseFromUrl(url);
            if (urlWithoutBase) {
              locationService.push(urlWithoutBase);
            }
          }
        }
      });
    }

    // delete panel
    this.bind('p r', () => {
      const panelId = dashboard.meta.focusPanelId;

      if (panelId && dashboard.canEditPanelById(panelId) && !(dashboard.panelInView || dashboard.panelInEdit)) {
        appEvents.publish(new RemovePanelEvent(panelId));
        dashboard.meta.focusPanelId = 0;
      }
    });

    // duplicate panel
    this.bind('p d', () => {
      const panelId = dashboard.meta.focusPanelId;

      if (panelId && dashboard.canEditPanelById(panelId)) {
        const panelIndex = dashboard.getPanelInfoById(panelId)!.index;
        dashboard.duplicatePanel(dashboard.panels[panelIndex]);
      }
    });

    // share panel
    this.bind('p s', () => {
      if (dashboard.meta.focusPanelId) {
        const panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);

        appEvents.publish(
          new ShowModalReactEvent({
            component: ShareModal,
            props: {
              dashboard: dashboard,
              panel: panelInfo?.panel,
            },
          })
        );
      }
    });

    // toggle panel legend
    this.bind('p l', () => {
      if (dashboard.meta.focusPanelId) {
        const panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId)!;

        if (panelInfo.panel.legend) {
          panelInfo.panel.legend.show = !panelInfo.panel.legend.show;
          panelInfo.panel.render();
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
      locationService.push('/dashboard/new');
    });

    this.bind('d r', () => {
      dashboard.startRefresh();
    });

    this.bind('d s', () => {
      this.showDashEditView();
    });

    this.bind('d k', () => {
      toggleKioskMode();
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
