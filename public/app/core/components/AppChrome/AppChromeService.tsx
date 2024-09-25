import { useObservable } from 'react-use';
import { BehaviorSubject } from 'rxjs';

import { AppEvents, NavModel, NavModelItem, PageLayoutType, UrlQueryValue } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import store from 'app/core/store';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';
import { KioskMode } from 'app/types';

import { RouteDescriptor } from '../../navigation/types';

import { ReturnToPreviousProps } from './ReturnToPrevious/ReturnToPrevious';

export interface AppChromeState {
  chromeless?: boolean;
  sectionNav: NavModel;
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
  searchBarHidden?: boolean;
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

export class AppChromeService {
  searchBarStorageKey = 'SearchBar_Hidden';
  private currentRoute?: RouteDescriptor;
  private routeChangeHandled = true;

  private megaMenuDocked = Boolean(
    window.innerWidth >= config.theme2.breakpoints.values.xl &&
      store.getBool(DOCKED_LOCAL_STORAGE_KEY, Boolean(window.innerWidth >= config.theme2.breakpoints.values.xxl))
  );

  private sessionStorageData = window.sessionStorage.getItem('returnToPrevious');
  private returnToPreviousData = this.sessionStorageData ? JSON.parse(this.sessionStorageData) : undefined;

  readonly state = new BehaviorSubject<AppChromeState>({
    chromeless: true, // start out hidden to not flash it on pages without chrome
    sectionNav: { node: { text: t('nav.home.title', 'Home') }, main: { text: '' } },
    searchBarHidden: store.getBool(this.searchBarStorageKey, false),
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
    reportInteraction('grafana_mega_menu_open', { state: newOpenState });
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
    let newKioskMode: KioskMode | undefined;

    switch (kiosk) {
      case 'tv':
        newKioskMode = KioskMode.TV;
        break;
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

    if (searchBarHidden || kioskMode === KioskMode.TV || config.featureToggles.singleTopNav) {
      appEvents.emit(AppEvents.alertInfo, [t('navigation.kiosk.tv-alert', 'Press ESC to exit kiosk mode')]);
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
