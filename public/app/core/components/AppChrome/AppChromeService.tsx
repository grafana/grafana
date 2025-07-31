import { useObservable } from 'react-use';
import { BehaviorSubject } from 'rxjs';

import { AppEvents, NavModel, NavModelItem, PageLayoutType, UrlQueryValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import store from 'app/core/store';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';
import { KioskMode } from 'app/types/dashboard';

import { RouteDescriptor } from '../../navigation/types';
import { buildBreadcrumbs } from '../Breadcrumbs/utils';

import { logDuplicateUnifiedHistoryEntryEvent } from './History/eventsTracking';
import { ReturnToPreviousProps } from './ReturnToPrevious/ReturnToPrevious';
import { HistoryEntry } from './types';

export interface AppChromeState {
  chromeless?: boolean;
  sectionNav: NavModel;
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
  breadcrumbActions?: React.ReactNode;
  megaMenuOpen: boolean;
  megaMenuDocked: boolean;
  kioskMode: KioskMode | null;
  layout: PageLayoutType;
  returnToPrevious?: {
    title: ReturnToPreviousProps['title'];
    href: ReturnToPreviousProps['href'];
  };
}

export const DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.docked';
export const DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY = 'grafana.navigation.open';
export const HISTORY_LOCAL_STORAGE_KEY = 'grafana.navigation.history';

export class AppChromeService {
  searchBarStorageKey = 'SearchBar_Hidden';
  private currentRoute?: RouteDescriptor;
  private routeChangeHandled = true;

  private megaMenuDocked = Boolean(
    window.innerWidth >= config.theme2.breakpoints.values.xl &&
      store.getBool(DOCKED_LOCAL_STORAGE_KEY, Boolean(window.innerWidth >= config.theme2.breakpoints.values.xl))
  );

  private sessionStorageData = window.sessionStorage.getItem('returnToPrevious');
  private returnToPreviousData = this.sessionStorageData ? JSON.parse(this.sessionStorageData) : undefined;

  readonly state = new BehaviorSubject<AppChromeState>({
    chromeless: true, // start out hidden to not flash it on pages without chrome
    sectionNav: { node: { text: t('nav.home.title', 'Home') }, main: { text: '' } },
    megaMenuOpen: this.megaMenuDocked && store.getBool(DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY, true),
    megaMenuDocked: this.megaMenuDocked,
    kioskMode: null,
    layout: PageLayoutType.Canvas,
    returnToPrevious: this.returnToPreviousData,
  });

  public setMatchedRoute(route: RouteDescriptor) {
    if (this.currentRoute !== route) {
      this.currentRoute = route;
      this.routeChangeHandled = false;
    }
  }

  public update(update: Partial<AppChromeState>) {
    const current = this.state.getValue();
    const newState: AppChromeState = {
      ...current,
    };

    // when route change update props from route and clear fields
    if (!this.routeChangeHandled) {
      newState.actions = undefined;
      newState.pageNav = undefined;
      newState.sectionNav = { node: { text: t('nav.home.title', 'Home') }, main: { text: '' } };
      newState.chromeless = this.currentRoute?.chromeless;
      newState.layout = PageLayoutType.Standard;
      this.routeChangeHandled = true;
    }

    Object.assign(newState, update);

    // KioskMode overrides chromeless state
    newState.chromeless = newState.kioskMode === KioskMode.Full || this.currentRoute?.chromeless;

    if (!this.ignoreStateUpdate(newState, current)) {
      config.featureToggles.unifiedHistory &&
        store.setObject(HISTORY_LOCAL_STORAGE_KEY, this.getUpdatedHistory(newState));
      this.state.next(newState);
    }
  }

  public setReturnToPrevious = (returnToPrevious: ReturnToPreviousProps) => {
    const previousPage = this.state.getValue().returnToPrevious;
    reportInteraction('grafana_return_to_previous_button_created', {
      page: returnToPrevious.href,
      previousPage: previousPage?.href,
    });

    this.update({ returnToPrevious });
    window.sessionStorage.setItem('returnToPrevious', JSON.stringify(returnToPrevious));
  };

  public clearReturnToPrevious = (interactionAction: 'clicked' | 'dismissed' | 'auto_dismissed') => {
    const existingRtp = this.state.getValue().returnToPrevious;
    if (existingRtp) {
      reportInteraction('grafana_return_to_previous_button_dismissed', {
        action: interactionAction,
        page: existingRtp.href,
      });
    }

    this.update({ returnToPrevious: undefined });
    window.sessionStorage.removeItem('returnToPrevious');
  };

  private getUpdatedHistory(newState: AppChromeState): HistoryEntry[] {
    const breadcrumbs = buildBreadcrumbs(newState.sectionNav.node, newState.pageNav, { text: 'Home', url: '/' }, true);
    const newPageNav = newState.pageNav || newState.sectionNav.node;

    let entries = store.getObject<HistoryEntry[]>(HISTORY_LOCAL_STORAGE_KEY, []);
    const clickedHistory = store.getObject<boolean>('CLICKING_HISTORY');
    if (clickedHistory) {
      store.setObject('CLICKING_HISTORY', false);
      return entries;
    }
    if (!newPageNav) {
      return entries;
    }

    const lastEntry = entries[0];
    const newEntry = { name: newPageNav.text, views: [], breadcrumbs, time: Date.now(), url: window.location.href };
    const isSamePath = lastEntry && newEntry.url.split('?')[0] === lastEntry.url.split('?')[0];

    // To avoid adding an entry with the same path twice, we always use the latest one
    if (isSamePath) {
      entries[0] = newEntry;
    } else {
      if (lastEntry && lastEntry.name === newEntry.name) {
        logDuplicateUnifiedHistoryEntryEvent({
          entryName: newEntry.name,
          lastEntryURL: lastEntry.url,
          newEntryURL: newEntry.url,
        });
      }
      entries = [newEntry, ...entries];
    }

    return entries;
  }
  private ignoreStateUpdate(newState: AppChromeState, current: AppChromeState) {
    if (isShallowEqual(newState, current)) {
      return true;
    }

    // Some updates can have new instance of sectionNav or pageNav but with same values
    if (newState.sectionNav !== current.sectionNav || newState.pageNav !== current.pageNav) {
      if (
        newState.actions === current.actions &&
        newState.layout === current.layout &&
        navItemsAreTheSame(newState.sectionNav.node, current.sectionNav.node) &&
        navItemsAreTheSame(newState.pageNav, current.pageNav)
      ) {
        return true;
      }
    }

    return false;
  }

  public useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObservable(this.state, this.state.getValue());
  }

  public setMegaMenuOpen = (newOpenState: boolean) => {
    const { megaMenuDocked } = this.state.getValue();
    if (megaMenuDocked) {
      store.set(DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY, newOpenState);
    }
    reportInteraction('grafana_mega_menu_open', {
      state: newOpenState,
    });
    this.update({
      megaMenuOpen: newOpenState,
    });
  };

  public setMegaMenuDocked = (newDockedState: boolean, updatePersistedState = true) => {
    if (updatePersistedState) {
      store.set(DOCKED_LOCAL_STORAGE_KEY, newDockedState);
    }
    reportInteraction('grafana_mega_menu_docked', { state: newDockedState });
    this.update({
      megaMenuDocked: newDockedState,
    });
  };

  public onToggleKioskMode = () => {
    const nextMode = this.getNextKioskMode();
    this.update({ kioskMode: nextMode });
    locationService.partial({ kiosk: this.getKioskUrlValue(nextMode) });
    reportInteraction('grafana_kiosk_mode', {
      action: 'toggle',
      mode: nextMode,
    });
  };

  public exitKioskMode() {
    this.update({ kioskMode: undefined });
    locationService.partial({ kiosk: null });
    reportInteraction('grafana_kiosk_mode', {
      action: 'exit',
    });
  }

  public setKioskModeFromUrl(kiosk: UrlQueryValue) {
    let newKioskMode: KioskMode | undefined;

    switch (kiosk) {
      case '1':
      case true:
        newKioskMode = KioskMode.Full;
    }

    if (newKioskMode && newKioskMode !== this.state.getValue().kioskMode) {
      this.update({ kioskMode: newKioskMode });
    }
  }

  public getKioskUrlValue(mode: KioskMode | null) {
    switch (mode) {
      case KioskMode.Full:
        return true;
      default:
        return null;
    }
  }

  private getNextKioskMode() {
    appEvents.emit(AppEvents.alertInfo, [t('navigation.kiosk.tv-alert', 'Press ESC to exit kiosk mode')]);
    return KioskMode.Full;
  }
}

/**
 * Checks if text, url, active child url and parent are the same
 **/
function navItemsAreTheSame(a: NavModelItem | undefined, b: NavModelItem | undefined): boolean {
  if (a === b) {
    return true;
  }

  const aActiveChild = a?.children?.find((child) => child.active);
  const bActiveChild = b?.children?.find((child) => child.active);

  return (
    a?.text === b?.text &&
    a?.url === b?.url &&
    aActiveChild?.url === bActiveChild?.url &&
    navItemsAreTheSame(a?.parentItem, b?.parentItem)
  );
}
