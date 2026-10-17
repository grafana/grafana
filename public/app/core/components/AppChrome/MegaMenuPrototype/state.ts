// PROTOTYPE — throwaway. Mega menu solutions prototype (.scratch/mega-menu-solutions/spec.md).
// Three variants of the solutions mega menu, switchable via `?navPrototype=A|B|C|off` and the
// floating bar at the bottom of the screen. Nothing here is production code.
import { useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { store } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { type AppChromeService } from 'app/core/components/AppChrome/AppChromeService';

export type PrototypeVariant = 'A' | 'B' | 'C';
export const VARIANTS: PrototypeVariant[] = ['A', 'B', 'C'];
export const VARIANT_NAMES: Record<PrototypeVariant, string> = {
  A: 'Tile grid + anchored popout',
  B: 'Named switcher + side panel',
  C: 'Site map + wide popout',
};

const VARIANT_PARAM = 'navPrototype';
const VARIANT_KEY = 'grafana.PROTOTYPE.navVariant';
const SOLUTION_KEY = 'grafana.PROTOTYPE.navSolution';

const isVariant = (v: string | null): v is PrototypeVariant => v === 'A' || v === 'B' || v === 'C';

// The URL param wins so variants are shareable; sessionStorage keeps the variant while navigating
// around the app (Grafana drops unknown params on navigation).
export function usePrototypeVariant(): PrototypeVariant | undefined {
  const { search } = useLocation();
  const fromUrl = new URLSearchParams(search).get(VARIANT_PARAM);
  if (fromUrl === 'off') {
    sessionStorage.removeItem(VARIANT_KEY);
    return undefined;
  }
  if (isVariant(fromUrl)) {
    sessionStorage.setItem(VARIANT_KEY, fromUrl);
    return fromUrl;
  }
  const stored = sessionStorage.getItem(VARIANT_KEY);
  return isVariant(stored) ? stored : undefined;
}

export function setPrototypeVariant(variant: PrototypeVariant | 'off') {
  locationService.partial({ [VARIANT_PARAM]: variant }, true);
}

function createStore<T>(initial: T) {
  let value = initial;
  const subscribers = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      subscribers.forEach((s) => s());
    },
    subscribe: (cb: () => void) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}

type Store<T> = ReturnType<typeof createStore<T>>;

export function useStoreValue<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

export const activeSolutionStore = createStore<string>(store.get(SOLUTION_KEY) ?? 'observability');

export function setActiveSolution(id: string) {
  store.set(SOLUTION_KEY, id);
  activeSolutionStore.set(id);
}

// Hover-to-open: the menu opened by hover closes again shortly after the pointer leaves it. Any click
// inside the menu turns it into a normal (click-opened) menu that stays until dismissed.
export const hoverOpenedStore = createStore(false);
let closeTimer: ReturnType<typeof setTimeout> | undefined;

export function cancelHoverClose() {
  clearTimeout(closeTimer);
}

// Element-level mouseleave is unreliable here (opening the menu re-renders the trigger), so while a
// hover-opened menu is showing, track the pointer on the document instead.
let pointerListener: ((e: PointerEvent) => void) | undefined;

function stopTrackingPointer() {
  if (pointerListener) {
    document.removeEventListener('pointermove', pointerListener);
    pointerListener = undefined;
  }
}

function trackPointer(chrome: AppChromeService) {
  if (pointerListener) {
    return;
  }
  pointerListener = (e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el?.closest('[data-proto-menu], [data-proto-floating], [data-proto-hover-zone]')) {
      cancelHoverClose();
    } else {
      scheduleHoverClose(chrome);
    }
  };
  document.addEventListener('pointermove', pointerListener);
}

export function openByHover(chrome: AppChromeService) {
  cancelHoverClose();
  if (!chrome.state.getValue().megaMenuOpen) {
    hoverOpenedStore.set(true);
    chrome.setMegaMenuOpen(true);
    trackPointer(chrome);
  }
}

export function scheduleHoverClose(chrome: AppChromeService) {
  if (!hoverOpenedStore.get()) {
    return;
  }
  cancelHoverClose();
  closeTimer = setTimeout(() => {
    stopTrackingPointer();
    hoverOpenedStore.set(false);
    chrome.setMegaMenuOpen(false);
  }, 350);
}

export function stickHoverOpen() {
  cancelHoverClose();
  stopTrackingPointer();
  hoverOpenedStore.set(false);
}

export function canHoverOpen(isXl: boolean) {
  return isXl && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

// Dashboard navigator: opened by choosing Dashboards in the mega menu, closed by its close button or
// by leaving the Dashboards section. Session-scoped so a reload inside Dashboards keeps it open.
const NAVIGATOR_KEY = 'grafana.PROTOTYPE.dashboardNavigator';
export const dashboardNavigatorStore = createStore(sessionStorage.getItem(NAVIGATOR_KEY) === 'open');

export function setDashboardNavigatorOpen(open: boolean) {
  if (open) {
    sessionStorage.setItem(NAVIGATOR_KEY, 'open');
  } else {
    sessionStorage.removeItem(NAVIGATOR_KEY);
  }
  dashboardNavigatorStore.set(open);
}

export const isDashboardsPath = (pathname: string) =>
  pathname.startsWith('/d/') || pathname === '/dashboards' || pathname.startsWith('/dashboards/');

export const DASHBOARDS_SECTION_ID = 'dashboards/browse';
