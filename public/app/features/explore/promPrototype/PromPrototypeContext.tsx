// Prototype-only context. Not internationalized.
// Holds the A/B/C selection and Option A's rail collapse state.
//
// Persisted to URL query param so demo links are shareable:
//   ?promProto=a|b|c
// Falls back to localStorage between sessions.
/* eslint-disable @grafana/no-direct-local-storage-access -- prototype-only persistence */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- prototype-only casts */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ensureFakeLokiRegistered } from './mockLokiDatasource';

export type PromPrototypeOption = 'a' | 'b' | 'c';

const LS_OPTION = 'grafana.promPrototype.option';
const LS_COLLAPSED = 'grafana.promPrototype.railCollapsed';
const QP_OPTION = 'promProto';
// Popover trigger flag (Option C, once-per-session unless pinned).
const SS_POPOVER_SHOWN = 'grafana.promPrototype.popoverShown';

interface PromPrototypeContextValue {
  option: PromPrototypeOption;
  setOption: (o: PromPrototypeOption) => void;
  // Option A rail collapse.
  railCollapsed: boolean;
  setRailCollapsed: (c: boolean) => void;
  // Option C helpers.
  markPopoverShown: () => void;
  hasShownPopover: () => boolean;
  // Set when the user clicks the pin icon in Option C's flyout — promotes to Option A for the session.
  pinnedInSession: boolean;
  pinToRail: () => void;
}

const PromPrototypeContext = createContext<PromPrototypeContextValue | null>(null);

function readOptionFromUrl(): PromPrototypeOption | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const val = new URLSearchParams(window.location.search).get(QP_OPTION);
  if (val === 'a' || val === 'b' || val === 'c') {
    return val;
  }
  return null;
}

function writeQueryParam(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  // Replace so we don't spam browser history when toggling.
  window.history.replaceState({}, '', url.toString());
}

function readLocalStorage(key: string, allowed: string[], fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const val = window.localStorage.getItem(key);
  return val && allowed.includes(val) ? val : fallback;
}

export function PromPrototypeProvider({ children }: { children: ReactNode }) {
  const [option, setOptionState] = useState<PromPrototypeOption>(() => {
    return readOptionFromUrl() ?? (readLocalStorage(LS_OPTION, ['a', 'b', 'c'], 'a') as PromPrototypeOption);
  });
  const [railCollapsed, setRailCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(LS_COLLAPSED) === 'true';
  });
  const [pinnedInSession, setPinnedInSession] = useState(false);

  const setOption = useCallback((o: PromPrototypeOption) => {
    setOptionState(o);
    writeQueryParam(QP_OPTION, o);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_OPTION, o);
    }
  }, []);

  const setRailCollapsed = useCallback((c: boolean) => {
    setRailCollapsedState(c);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_COLLAPSED, String(c));
    }
  }, []);

  const markPopoverShown = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SS_POPOVER_SHOWN, 'true');
    }
  }, []);

  const hasShownPopover = useCallback(() => {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(SS_POPOVER_SHOWN) === 'true';
  }, []);

  const pinToRail = useCallback(() => {
    setPinnedInSession(true);
    // Ensure the rail is visible for the rest of the session.
    setOptionState('a');
    writeQueryParam(QP_OPTION, 'a');
  }, []);

  // Keep initial URL params in sync on mount, so the first render has canonical params.
  useEffect(() => {
    writeQueryParam(QP_OPTION, option);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register the prototype-only fake Loki data source so a Mixed pane can add a
  // non-Prometheus query for the demo. Idempotent.
  useEffect(() => {
    ensureFakeLokiRegistered();
  }, []);

  const value = useMemo<PromPrototypeContextValue>(
    () => ({
      option,
      setOption,
      railCollapsed,
      setRailCollapsed,
      markPopoverShown,
      hasShownPopover,
      pinnedInSession,
      pinToRail,
    }),
    [option, setOption, railCollapsed, setRailCollapsed, markPopoverShown, hasShownPopover, pinnedInSession, pinToRail]
  );

  return <PromPrototypeContext.Provider value={value}>{children}</PromPrototypeContext.Provider>;
}

export function usePromPrototype(): PromPrototypeContextValue {
  const ctx = useContext(PromPrototypeContext);
  if (!ctx) {
    // Prototype-only: fall back to a no-op rather than throw, so non-Prometheus flows are safe.
    return {
      option: 'a',
      setOption: () => {},
      railCollapsed: false,
      setRailCollapsed: () => {},
      markPopoverShown: () => {},
      hasShownPopover: () => false,
      pinnedInSession: false,
      pinToRail: () => {},
    };
  }
  return ctx;
}
