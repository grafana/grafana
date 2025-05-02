import { LegacyGraphHoverClearEvent, SetPanelAttentionEvent, locationUtil } from '@grafana/data';
import { LocationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { getExploreUrl } from 'app/core/utils/explore';
import { SaveDashboardDrawer } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer';
import { ShareModal } from 'app/features/dashboard/components/ShareModal/ShareModal';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { getTimeSrv } from '../../features/dashboard/services/TimeSrv';
import {
  RemovePanelEvent,
  ShiftTimeEvent,
  ShiftTimeEventDirection,
  ShowModalReactEvent,
  ZoomOutEvent,
  AbsoluteTimeEvent,
  CopyTimeEvent,
  PasteTimeEvent,
} from '../../types/events';
import { AppChromeService } from '../components/AppChrome/AppChromeService';
import { HelpModal } from '../components/help/HelpModal';
import { contextSrv } from '../core';
import { RouteDescriptor } from '../navigation/types';

import { mousetrap } from './mousetrap';
import { toggleTheme } from './theme';

export class KeybindingSrv {
  constructor(
    private locationService: LocationService,
    private chromeService: AppChromeService
  ) {
    // No cleanup needed, since KeybindingSrv is a singleton
    appEvents.subscribe(SetPanelAttentionEvent, (event) => {
      this.panelId = event.payload.panelId;
    });
  }
  /** string for VizPanel key and number for panelId */
  private panelId: string | number | null = null;

  clearAndInitGlobalBindings(route: RouteDescriptor) {
    mousetrap.reset();

    // Chromeless pages like login and signup page don't get any global bindings
    if (!route.chromeless) {
      this.bind('?', this.showHelpModal);
      this.bind('g h', this.goToHome);
      this.bind('g d', this.goToDashboards);
      this.bind('g e', this.goToExplore);
      this.bind('g a', this.openAlerting);
      this.bind('g p', this.goToProfile);
      this.bind('esc', this.exit);
      this.bindGlobalEsc();
    }

    this.bind('c t', () => toggleTheme(false));
    this.bind('c r', () => toggleTheme(true));
  }

  bindGlobalEsc() {
    this.bindGlobal('esc', this.globalEsc);
  }

  globalEsc() {
    const anyDoc = document;
    const activeElement = anyDoc.activeElement;

    // typehead needs to handle it
    const typeaheads = document.querySelectorAll('.slate-typeahead--open');
    if (typeaheads.length > 0) {
      return;
    }

    // second check if we are in an input we can blur
    if (activeElement && activeElement instanceof HTMLElement) {
      if (
        activeElement.nodeName === 'INPUT' ||
        activeElement.nodeName === 'TEXTAREA' ||
        activeElement.hasAttribute('data-slate-editor')
      ) {
        activeElement.blur();
        return;
      }
    }

    // ok no focused input or editor that should block this, let exist!
    this.exit();
  }

  private openAlerting() {
    this.locationService.push('/alerting');
  }

  private goToDashboards() {
    this.locationService.push('/dashboards');
  }

  private goToHome() {
    this.locationService.push('/');
  }

  private goToProfile() {
    this.locationService.push('/profile');
  }

  private goToExplore() {
    this.locationService.push('/explore');
  }

  private showHelpModal() {
    appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
  }

  private exit() {
    const search = this.locationService.getSearchObject();

    if (search.editview) {
      this.locationService.partial({ editview: null, editIndex: null });
      return;
    }

    if (search.inspect) {
      this.locationService.partial({ inspect: null, inspectTab: null });
      return;
    }

    if (search.editPanel) {
      this.locationService.partial({ editPanel: null, tab: null });
      return;
    }

    if (search.viewPanel) {
      this.locationService.partial({ viewPanel: null, tab: null });
      return;
    }

    const { kioskMode } = this.chromeService.state.getValue();
    if (kioskMode) {
      this.chromeService.exitKioskMode();
    }
  }

  private showDashEditView() {
    this.locationService.partial({
      editview: 'settings',
    });
  }

  bind(keyArg: string | string[], fn: () => void) {
    mousetrap.bind(
      keyArg,
      (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        fn.call(this);
      },
      'keydown'
    );
  }

  bindGlobal(keyArg: string, fn: () => void) {
    mousetrap.bindGlobal(
      keyArg,
      (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        fn.call(this);
      },
      'keydown'
    );
  }

  unbind(keyArg: string, keyType?: string) {
    mousetrap.unbind(keyArg, keyType);
  }

  bindWithPanelId(keyArg: string, fn: (panelId: number) => void) {
    this.bind(keyArg, this.withFocusedPanel(fn));
  }

  withFocusedPanel(fn: (panelId: number) => void) {
    return () => {
      if (typeof this.panelId === 'number') {
        fn(this.panelId);
        return;
      }
    };
  }

  setupTimeRangeBindings(updateUrl = true) {
    this.bind('t a', () => {
      appEvents.publish(new AbsoluteTimeEvent({ updateUrl }));
    });

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

    this.bind('t c', () => {
      appEvents.publish(new CopyTimeEvent());
    });

    this.bind('t v', () => {
      appEvents.publish(new PasteTimeEvent({ updateUrl }));
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
        const isEditing = this.locationService.getSearchObject().editPanel !== undefined;
        this.locationService.partial({ editPanel: isEditing ? null : panelId });
      }
    });

    // view panel
    this.bindWithPanelId('v', (panelId) => {
      const isViewing = this.locationService.getSearchObject().viewPanel !== undefined;
      this.locationService.partial({ viewPanel: isViewing ? null : panelId });
    });

    //toggle legend
    this.bindWithPanelId('p l', (panelId) => {
      const panel = dashboard.getPanelById(panelId)!;
      const newOptions = { ...panel.options };

      newOptions.legend.showLegend ? (newOptions.legend.showLegend = false) : (newOptions.legend.showLegend = true);

      panel.updateOptions(newOptions);
    });

    this.bindWithPanelId('i', (panelId) => {
      this.locationService.partial({ inspect: panelId });
    });

    // jump to explore if permissions allow
    if (contextSrv.hasAccessToExplore()) {
      this.bindWithPanelId('p x', async (panelId) => {
        const panel = dashboard.getPanelById(panelId)!;
        const url = await getExploreUrl({
          queries: panel.targets,
          dsRef: panel.datasource,
          scopedVars: panel.scopedVars,
          timeRange: getTimeSrv().timeRange(),
        });

        if (url) {
          const urlWithoutBase = locationUtil.stripBaseFromUrl(url);
          if (urlWithoutBase) {
            this.locationService.push(urlWithoutBase);
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

    // toggle all exemplars
    this.bind('d x', () => {
      dashboard.toggleExemplarsForAll();
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
      this.locationService.push('/dashboard/new');
    });

    this.bind('d r', () => {
      dashboard.startRefresh();
    });

    this.bind('d s', () => {
      this.showDashEditView();
    });

    this.bind('d k', () => {
      this.chromeService.onToggleKioskMode();
    });

    //Autofit panels
    this.bind('d a', () => {
      // this has to be a full page reload
      const queryParams = this.locationService.getSearchObject();
      const newUrlParam = queryParams.autofitpanels ? '' : '&autofitpanels';
      window.location.href = window.location.href + newUrlParam;
    });
  }
}
