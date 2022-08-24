import Mousetrap from 'mousetrap';

import 'mousetrap-global-bind';
import 'mousetrap/plugins/global-bind/mousetrap-global-bind';
import { LegacyGraphHoverClearEvent, locationUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { getExploreUrl } from 'app/core/utils/explore';
import { SaveDashboardDrawer } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { DashboardModel } from 'app/features/dashboard/state';

import { getTimeSrv } from '../../features/dashboard/services/TimeSrv';
import { getDatasourceSrv } from '../../features/plugins/datasource_srv';
import {
  RemovePanelEvent,
  ShiftTimeEvent,
  ShiftTimeEventDirection,
  ShowModalReactEvent,
  ZoomOutEvent,
  AbsoluteTimeEvent,
} from '../../types/events';
import { HelpModal } from '../components/help/HelpModal';
import { contextSrv } from '../core';
import { exitKioskMode, toggleKioskMode } from '../navigation/kiosk';

import { toggleTheme } from './toggleTheme';
import { withFocusedPanel } from './withFocusedPanelId';

export class KeybindingSrv {
  reset() {
    Mousetrap.reset();
  }

  initGlobals() {
    if (locationService.getLocation().pathname !== '/login') {
      this.bind(['?', 'h'], this.showHelpModal);
      this.bind('g h', this.goToHome);
      this.bind('g a', this.openAlerting);
      this.bind('g p', this.goToProfile);
      this.bind('s o', this.openSearch);
      this.bind('t a', this.makeAbsoluteTime);
      this.bind('f', this.openSearch);
      this.bind('esc', this.exit);
      this.bindGlobal('esc', this.globalEsc);
    }

    this.bind('t t', () => toggleTheme(false));
    this.bind('t r', () => toggleTheme(true));

    if (process.env.NODE_ENV === 'development') {
      this.bind('t n', () => this.toggleNav());
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

  toggleNav() {
    window.location.href = locationUtil.getUrlForPartial(locationService.getLocation(), {
      '__feature.topnav': (!config.featureToggles.topnav).toString(),
    });
  }

  private openSearch() {
    locationService.partial({ search: 'open' });
  }

  private closeSearch() {
    locationService.partial({ search: null });
  }

  private openAlerting() {
    locationService.push('/alerting');
  }

  private goToHome() {
    locationService.push('/');
  }

  private goToProfile() {
    locationService.push('/profile');
  }

  private makeAbsoluteTime() {
    appEvents.publish(new AbsoluteTimeEvent());
  }

  private showHelpModal() {
    appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
  }

  private exit() {
    const search = locationService.getSearchObject();

    if (search.editview) {
      locationService.partial({ editview: null, editIndex: null });
      return;
    }

    if (search.inspect) {
      locationService.partial({ inspect: null, inspectTab: null });
      return;
    }

    if (search.editPanel) {
      locationService.partial({ editPanel: null, tab: null });
      return;
    }

    if (search.viewPanel) {
      locationService.partial({ viewPanel: null, tab: null });
      return;
    }

    if (search.kiosk) {
      exitKioskMode();
    }

    if (search.search) {
      this.closeSearch();
    }
  }

  private showDashEditView() {
    locationService.partial({
      editview: 'settings',
    });
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

  bindWithPanelId(keyArg: string, fn: (panelId: number) => void) {
    this.bind(keyArg, withFocusedPanel(fn));
  }

  setupTimeRangeBindings(updateUrl = true) {
    this.bind('t z', () => {
      appEvents.publish(new ZoomOutEvent({ scale: 2, updateUrl }));
    });

    this.bind('ctrl+z', () => {
      appEvents.publish(new ZoomOutEvent({ scale: 2, updateUrl }));
    });

    this.bind('t left', () => {
      appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Left, updateUrl }));
    });

    this.bind('t right', () => {
      appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Right, updateUrl }));
    });
  }

  setupDashboardBindings(dashboard: DashboardModel) {
    this.bind('mod+o', () => {
      dashboard.graphTooltip = (dashboard.graphTooltip + 1) % 3;
      dashboard.events.publish(new LegacyGraphHoverClearEvent());
      dashboard.startRefresh();
    });

    this.bind('mod+s', () => {
      if (dashboard.meta.canSave) {
        appEvents.publish(
          new ShowModalReactEvent({
            component: SaveDashboardDrawer,
            props: {
              dashboard,
            },
          })
        );
      }
    });

    this.setupTimeRangeBindings();

    // edit panel
    this.bindWithPanelId('e', (panelId) => {
      if (dashboard.canEditPanelById(panelId)) {
        const isEditing = locationService.getSearchObject().editPanel !== undefined;
        locationService.partial({ editPanel: isEditing ? null : panelId });
      }
    });

    // view panel
    this.bindWithPanelId('v', (panelId) => {
      const isViewing = locationService.getSearchObject().viewPanel !== undefined;
      locationService.partial({ viewPanel: isViewing ? null : panelId });
    });

    //toggle legend
    this.bindWithPanelId('p l', (panelId) => {
      const panel = dashboard.getPanelById(panelId)!;
      const newOptions = { ...panel.options };

      newOptions.legend.showLegend ? (newOptions.legend.showLegend = false) : (newOptions.legend.showLegend = true);

      panel.updateOptions(newOptions);
    });

    this.bindWithPanelId('i', (panelId) => {
      locationService.partial({ inspect: panelId });
    });

    // jump to explore if permissions allow
    if (contextSrv.hasAccessToExplore()) {
      this.bindWithPanelId('x', async (panelId) => {
        const panel = dashboard.getPanelById(panelId)!;
        const url = await getExploreUrl({
          panel,
          datasourceSrv: getDatasourceSrv(),
          timeSrv: getTimeSrv(),
        });

        if (url) {
          const urlWithoutBase = locationUtil.stripBaseFromUrl(url);
          if (urlWithoutBase) {
            locationService.push(urlWithoutBase);
          }
        }
      });
    }

    // delete panel
    this.bindWithPanelId('p r', (panelId) => {
      if (dashboard.canEditPanelById(panelId) && !(dashboard.panelInView || dashboard.panelInEdit)) {
        appEvents.publish(new RemovePanelEvent(panelId));
      }
    });

    // duplicate panel
    this.bindWithPanelId('p d', (panelId) => {
      if (dashboard.canEditPanelById(panelId)) {
        const panelIndex = dashboard.getPanelInfoById(panelId)!.index;
        dashboard.duplicatePanel(dashboard.panels[panelIndex]);
      }
    });

    // share panel
    this.bindWithPanelId('p s', (panelId) => {
      const panelInfo = dashboard.getPanelInfoById(panelId);

      appEvents.publish(
        new ShowModalReactEvent({
          component: ShareModal,
          props: {
            dashboard: dashboard,
            panel: panelInfo?.panel,
          },
        })
      );
    });

    // toggle panel legend

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
      const queryParams = locationService.getSearchObject();
      const newUrlParam = queryParams.autofitpanels ? '' : '&autofitpanels';
      window.location.href = window.location.href + newUrlParam;
    });
  }
}

export const keybindingSrv = new KeybindingSrv();
