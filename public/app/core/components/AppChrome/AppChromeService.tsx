import { BehaviorSubject } from 'rxjs';

import { AppEvents, type NavModel, type NavModelItem, PageLayoutType, store, type UrlQueryValue } from '@grafana/data';
import { useObservable } from '@grafana/data/unstable';
import { t } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { rememberLoginSectionTitle } from 'app/core/services/loginSectionTitle';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';
import { KioskMode } from 'app/types/dashboard';

import { type RouteDescriptor } from '../../navigation/types';

import { type ReturnToPreviousProps } from './ReturnToPrevious/ReturnToPrevious';

export interface AppChromeState {
  chromeless?: boolean;
  sectionNav: NavModel;
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
  breadcrumbActions?: React.ReactNode;
  sidePanel?: { full: React.ReactNode; compact: React.ReactNode };
  megaMenuOpen: boolean;
  megaMenuDocked: boolean;
  /** The undocked mega menu is open only while the pointer rests on its toggle or on the menu itself. */
  megaMenuPeek?: boolean;
  kioskMode: KioskMode | null;
  layout: PageLayoutType;
  returnToPrevious?: {
    title: ReturnToPreviousProps['title'];
    href: ReturnToPreviousProps['href'];
  };
}

export const DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.docked';
const DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY = 'grafana.navigation.open';
/** Long enough that a pointer passing over the toggle on its way elsewhere does not open the menu. */
export const MEGA_MENU_PEEK_OPEN_DELAY = 150;
/** Long enough to cross the gap between the toggle and the menu below it. */
export const MEGA_MENU_PEEK_CLOSE_DELAY = 300;

/**
 * Nav held before a page sets its own: at startup and between a route change and the new page's first
 * update. Its empty `main.text` is what `getPageTitle` keys on, so it never reads as a page title.
 */
function placeholderSectionNav(): NavModel {
  return { node: { text: t('nav.home.title', 'Home') }, main: { text: '' } };
}

/** The title the current page gave the chrome: its `pageNav` text, else its section's; `undefined` while the placeholder is held. */
export function getPageTitle({ pageNav, sectionNav }: AppChromeState): string | undefined {
  if (pageNav?.text) {
    return pageNav.text;
  }
  return sectionNav.main.text ? sectionNav.node.text : undefined;
}

export class AppChromeService {
  searchBarStorageKey = 'SearchBar_Hidden';
  private currentRoute?: RouteDescriptor;
  private routeChangeHandled = true;

  private megaMenuDocked = Boolean(
    window.innerWidth >= config.theme2.breakpoints.values.xl &&
      store.getBool(DOCKED_LOCAL_STORAGE_KEY, Boolean(window.innerWidth >= config.theme2.breakpoints.values.xl))
  );
  private megaMenuPeekTimer?: ReturnType<typeof setTimeout>;
  private megaMenuPeekHeldOff = false;
  /** Set while a peek, or the menu a press in it kept open, shows a docked menu the user closed over the page. */
  private megaMenuUndockedByPeek = false;

  private sessionStorageData = window.sessionStorage.getItem('returnToPrevious');
  private returnToPreviousData = this.sessionStorageData ? JSON.parse(this.sessionStorageData) : undefined;

  readonly state = new BehaviorSubject<AppChromeState>({
    chromeless: true, // start out hidden to not flash it on pages without chrome
    sectionNav: placeholderSectionNav(),
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
    if (
      getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPreserveLoginTabTitle, false) &&
      update.sectionNav &&
      contextSrv.user.isSignedIn
    ) {
      const pathname = locationService.getLocation().pathname;
      if (pathname !== '/login') {
        rememberLoginSectionTitle(update.sectionNav.node, pathname);
      }
    }

    const current = this.state.getValue();
    const newState: AppChromeState = {
      ...current,
    };

    // when route change update props from route and clear fields
    if (!this.routeChangeHandled) {
      newState.actions = undefined;
      newState.pageNav = undefined;
      newState.sectionNav = placeholderSectionNav();
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

  public setSidePanel = (sidePanel: AppChromeState['sidePanel']) => {
    const current = this.state.getValue();
    if (current.sidePanel !== sidePanel) {
      this.state.next({ ...current, sidePanel });
    }
  };

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

  public setMegaMenuOpen = (newOpenState: boolean, updatePersistedState = true) => {
    this.clearMegaMenuPeekTimer();
    const { megaMenuDocked } = this.state.getValue();
    if (megaMenuDocked && updatePersistedState) {
      store.set(DOCKED_MENU_OPEN_LOCAL_STORAGE_KEY, newOpenState);
    }
    reportInteraction('grafana_mega_menu_open', {
      state: newOpenState,
    });
    this.update({
      megaMenuOpen: newOpenState,
      megaMenuPeek: false,
      ...(newOpenState ? {} : this.dockedStateAfterPeek()),
    });
  };

  public setMegaMenuDocked = (newDockedState: boolean, updatePersistedState = true) => {
    this.clearMegaMenuPeekTimer();
    this.megaMenuUndockedByPeek = false;
    if (updatePersistedState) {
      store.set(DOCKED_LOCAL_STORAGE_KEY, newDockedState);
    }
    reportInteraction('grafana_mega_menu_docked', { state: newDockedState });
    this.update({
      megaMenuDocked: newDockedState,
      megaMenuPeek: false,
    });
  };

  /**
   * Opens the mega menu undocked once the pointer rests on its toggle. It stays open while the pointer is over the
   * toggle or the menu, and closes once it leaves both. Opening or docking the menu any other way ends the peek.
   */
  public startMegaMenuPeek = () => {
    this.clearMegaMenuPeekTimer();
    if (this.megaMenuPeekHeldOff || this.state.getValue().megaMenuOpen) {
      return;
    }
    this.megaMenuPeekTimer = setTimeout(() => {
      // A docked menu the user closed opens undocked too: a peek never moves the page. It docks again once it closes.
      this.megaMenuUndockedByPeek = this.state.getValue().megaMenuDocked;
      this.update({ megaMenuOpen: true, megaMenuDocked: false, megaMenuPeek: true });
    }, MEGA_MENU_PEEK_OPEN_DELAY);
  };

  /**
   * Once the pointer closes the docked menu with its toggle, the top bar toggle that appears under it does not open the
   * menu again until the pointer has left it.
   */
  public holdOffMegaMenuPeek = () => {
    this.megaMenuPeekHeldOff = true;
  };

  /** Keeps a peeking menu open while the pointer is over it. */
  public holdMegaMenuPeek = () => {
    this.clearMegaMenuPeekTimer();
  };

  /** Closes a peeking menu shortly after the pointer leaves, so the pointer can cross from the toggle to the menu. */
  public endMegaMenuPeek = () => {
    this.clearMegaMenuPeekTimer();
    this.megaMenuPeekHeldOff = false;
    if (!this.state.getValue().megaMenuPeek) {
      return;
    }
    this.megaMenuPeekTimer = setTimeout(() => {
      this.update({ megaMenuOpen: false, megaMenuPeek: false, ...this.dockedStateAfterPeek() });
    }, MEGA_MENU_PEEK_CLOSE_DELAY);
  };

  /**
   * As the menu a peek opened closes, puts back the docked state the peek set aside, so callers that open the docked
   * menu again still find it docked. Below the width the docked menu needs, as at startup, it stays undocked.
   */
  private dockedStateAfterPeek(): Partial<AppChromeState> {
    const undockedByPeek = this.megaMenuUndockedByPeek;
    this.megaMenuUndockedByPeek = false;
    return undockedByPeek && window.innerWidth >= config.theme2.breakpoints.values.xl ? { megaMenuDocked: true } : {};
  }

  private clearMegaMenuPeekTimer() {
    clearTimeout(this.megaMenuPeekTimer);
    this.megaMenuPeekTimer = undefined;
  }

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
    a?.highlightText === b?.highlightText &&
    aActiveChild?.url === bActiveChild?.url &&
    navItemsAreTheSame(a?.parentItem, b?.parentItem)
  );
}
