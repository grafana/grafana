import { useObservable } from 'react-use';
import { BehaviorSubject } from 'rxjs';

import { AppEvents, NavModelItem, UrlQueryValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import store from 'app/core/store';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';
import { KioskMode } from 'app/types';

import { RouteDescriptor } from '../../navigation/types';

export interface AppChromeState {
  chromeless?: boolean;
  sectionNav: NavModelItem;
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
  searchBarHidden?: boolean;
  megaMenuOpen?: boolean;
  kioskMode: KioskMode | null;
}

export class AppChromeService {
  searchBarStorageKey = 'SearchBar_Hidden';
  private currentRoute?: RouteDescriptor;
  private routeChangeHandled = true;

  readonly state = new BehaviorSubject<AppChromeState>({
    chromeless: true, // start out hidden to not flash it on pages without chrome
    sectionNav: { text: t('nav.home.title', 'Home') },
    searchBarHidden: store.getBool(this.searchBarStorageKey, false),
    kioskMode: null,
  });

  setMatchedRoute(route: RouteDescriptor) {
    if (this.currentRoute !== route) {
      this.currentRoute = route;
      this.routeChangeHandled = false;
    }
  }

  update(update: Partial<AppChromeState>) {
    const current = this.state.getValue();
    const newState: AppChromeState = {
      ...current,
    };

    // when route change update props from route and clear fields
    if (!this.routeChangeHandled) {
      newState.actions = undefined;
      newState.pageNav = undefined;
      newState.sectionNav = { text: t('nav.home.title', 'Home') };
      newState.chromeless = this.currentRoute?.chromeless;
      this.routeChangeHandled = true;
    }

    Object.assign(newState, update);

    // KioskMode overrides chromeless state
    newState.chromeless = newState.kioskMode === KioskMode.Full || this.currentRoute?.chromeless;

    if (!this.ignoreStateUpdate(newState, current)) {
      this.state.next(newState);
    }
  }

  ignoreStateUpdate(newState: AppChromeState, current: AppChromeState) {
    if (isShallowEqual(newState, current)) {
      return true;
    }

    // If we have new section nav or page nav but text is the same, skip update
    if (newState.sectionNav !== current.sectionNav || newState.pageNav !== current.pageNav) {
      // Some item level pages pass a new instance of pageNav on every render which will cause unnecessary AppChrome re-renders
      // Here we ignore all state updates where we get a new navModel or pageNav instance but with same text property
      if (newState.sectionNav.text === current.sectionNav.text && newState.pageNav?.text === current.pageNav?.text) {
        return true;
      }
    }

    return false;
  }

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObservable(this.state, this.state.getValue());
  }

  onToggleMegaMenu = () => {
    this.update({ megaMenuOpen: !this.state.getValue().megaMenuOpen });
  };

  setMegaMenu = (megaMenuOpen: boolean) => {
    this.update({ megaMenuOpen });
  };

  onToggleSearchBar = () => {
    const searchBarHidden = !this.state.getValue().searchBarHidden;
    store.set(this.searchBarStorageKey, searchBarHidden);
    this.update({ searchBarHidden });
  };

  onToggleKioskMode = () => {
    const nextMode = this.getNextKioskMode();
    this.update({ kioskMode: nextMode });
    locationService.partial({ kiosk: this.getKioskUrlValue(nextMode) });
  };

  exitKioskMode() {
    this.update({ kioskMode: undefined });
    locationService.partial({ kiosk: null });
  }

  setKioskModeFromUrl(kiosk: UrlQueryValue) {
    switch (kiosk) {
      case 'tv':
        this.update({ kioskMode: KioskMode.TV });
        break;
      case '1':
      case true:
        this.update({ kioskMode: KioskMode.Full });
    }
  }

  getKioskUrlValue(mode: KioskMode | null) {
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
