import { useObservable } from 'react-use';
import { BehaviorSubject } from 'rxjs';
import { string } from 'yargs';

import { AppEvents, NavModel, NavModelItem, PageLayoutType, UrlQueryValue } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import store from 'app/core/store';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';
import { KioskMode } from 'app/types';

import { RouteDescriptor } from '../../navigation/types';

import { HistoryEntryApp } from './types';

export interface AppChromeState {
  chromeless?: boolean;
  sectionNav: NavModel;
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
  searchBarHidden?: boolean;
  megaMenu: 'open' | 'closed' | 'docked';
  kioskMode: KioskMode | null;
  layout: PageLayoutType;
  history: HistoryEntryApp[];
}

const DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.docked';

export class AppChromeService {
  searchBarStorageKey = 'SearchBar_Hidden';
  private currentRoute?: RouteDescriptor;
  private routeChangeHandled = true;

  readonly state = new BehaviorSubject<AppChromeState>({
    chromeless: true, // start out hidden to not flash it on pages without chrome
    sectionNav: { node: { text: t('nav.home.title', 'Home') }, main: { text: '' } },
    searchBarHidden: store.getBool(this.searchBarStorageKey, false),
    megaMenu:
      config.featureToggles.dockedMegaMenu &&
      store.getBool(DOCKED_LOCAL_STORAGE_KEY, window.innerWidth >= config.theme2.breakpoints.values.xxl)
        ? 'docked'
        : 'closed',
    kioskMode: null,
    layout: PageLayoutType.Canvas,
    history: [],
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
      newState.history = this.getUpdatedHistory(newState, current);
      this.state.next(newState);
    }
  }

  private getSectionName(navModel: NavModel) {
    const sectionRootName = navModel.main.text;
    const parentName = navModel.node.parentItem?.text;
    const parentId = navModel.node.parentItem?.id;

    // For deeper level sections (apps)
    if (sectionRootName !== parentName && sectionRootName && parentId !== HOME_NAV_ID) {
      return `${sectionRootName} / ${parentName}`;
    }

    return navModel.main.text;
  }

  private getUpdatedHistory(newState: AppChromeState, currentState: AppChromeState): HistoryEntryApp[] {
    const pageName = newState.pageNav?.text || newState.sectionNav.node.text;
    const sectionName = this.getSectionName(newState.sectionNav);
    const oldPageName = currentState.pageNav?.text || currentState.sectionNav.node.text;

    let entries = currentState.history;
    let lastEntry = entries[0];

    const oldSectionName = entries[0]?.name;

    if (!sectionName) {
      return entries;
    }

    if (sectionName !== oldSectionName) {
      lastEntry = { name: sectionName, views: [] };
    }

    if (pageName !== oldPageName && oldPageName) {
      // Filter out the view if it already exists so we do not add same view twice
      lastEntry.views = lastEntry.views.filter((view) => view.name !== pageName);
      lastEntry.views.unshift({ name: pageName, url: window.location.href });
      console.log('adding entry view', pageName);
    }

    if (lastEntry !== currentState.history[0]) {
      entries = [lastEntry, ...entries];
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

  public setMegaMenu = (newMegaMenuState: AppChromeState['megaMenu']) => {
    if (config.featureToggles.dockedMegaMenu) {
      store.set(DOCKED_LOCAL_STORAGE_KEY, newMegaMenuState === 'docked');
      reportInteraction('grafana_mega_menu_state', { state: newMegaMenuState });
    } else {
      reportInteraction('grafana_toggle_menu_clicked', { action: newMegaMenuState === 'open' ? 'open' : 'close' });
    }
    this.update({ megaMenu: newMegaMenuState });
  };

  public onToggleSearchBar = () => {
    const { searchBarHidden, kioskMode } = this.state.getValue();
    const newSearchBarHidden = !searchBarHidden;
    store.set(this.searchBarStorageKey, newSearchBarHidden);

    if (kioskMode) {
      locationService.partial({ kiosk: null });
    }

    this.update({ searchBarHidden: newSearchBarHidden, kioskMode: null });
  };

  public onToggleKioskMode = () => {
    const nextMode = this.getNextKioskMode();
    this.update({ kioskMode: nextMode });
    locationService.partial({ kiosk: this.getKioskUrlValue(nextMode) });
  };

  public exitKioskMode() {
    this.update({ kioskMode: undefined });
    locationService.partial({ kiosk: null });
  }

  public setKioskModeFromUrl(kiosk: UrlQueryValue) {
    switch (kiosk) {
      case 'tv':
        this.update({ kioskMode: KioskMode.TV });
        break;
      case '1':
      case true:
        this.update({ kioskMode: KioskMode.Full });
    }
  }

  public getKioskUrlValue(mode: KioskMode | null) {
    switch (mode) {
      case KioskMode.TV:
        return 'tv';
      case KioskMode.Full:
        return true;
      default:
        return null;
    }
  }

  private getNextKioskMode() {
    const { kioskMode, searchBarHidden } = this.state.getValue();

    if (searchBarHidden || kioskMode === KioskMode.TV) {
      appEvents.emit(AppEvents.alertSuccess, [t('navigation.kiosk.tv-alert', 'Press ESC to exit kiosk mode')]);
      return KioskMode.Full;
    }

    if (!kioskMode) {
      return KioskMode.TV;
    }

    return null;
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
