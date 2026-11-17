import { useEffect, useRef } from 'react';
import { Observable } from 'rxjs';

import { useObservable } from '@grafana/data/unstable';
import { useScopes } from '@grafana/runtime';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { useDebouncedScopesEnabled } from 'app/features/scopes/useDebouncedScopesEnabled';

import { type AppChromeService } from './AppChromeService';

// Stable fallback so `useObservable` doesn't re-subscribe on every render when there's no scope
// service - a fresh `new Observable()` per render would otherwise look like a new source each time.
const EMPTY_OBSERVABLE = new Observable();

// Opening the overlay mega menu auto-focuses it (FocusScope in AppChromeMenu.tsx), which would
// otherwise yank focus away from whatever the user is typing in - e.g. a panel editor field - the
// moment scoped content shows up.
function isTypingInEditableField(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/**
 * Opens a closed mega menu the moment scoped suggested dashboards become available, so the user
 * isn't left wondering why nothing happened after applying a scope. Lives here rather than inside
 * ScopesDashboardsMegaMenuSection because that component only mounts while the mega menu is already
 * open (both the docked and overlay render paths unmount it on close) - it can never react to new
 * content in order to open a *closed* menu.
 *
 * Only mounted (via `AutoOpenMegaMenuForScopedContent` below) while the mega menu flag is on, so
 * there's no separate flag gating to do here. Chromeless/kiosk is gated inside the effect below
 * instead of at the mount level - mounting conditionally on it would unmount/remount this on every
 * kiosk-mode toggle, resetting `lastContentKeyRef` and making already-seen content look new again.
 */
function useAutoOpenMegaMenuForScopedContent(chrome: AppChromeService) {
  const { chromeless } = chrome.useState();
  const scopes = useScopes();
  // Debounced so a page that genuinely never enables scopes (e.g. Explore) doesn't open the menu
  // with an empty section - but the debounce's false-edge delay doesn't reopen a flap-closed menu
  // for content that was already seen, since genuinely new content only ever arrives together with
  // a real scope-apply action, which only happens on a page where scopes are already enabled.
  const showAsEnabled = useDebouncedScopesEnabled(scopes?.state.enabled ?? false);
  const scopeServices = useScopesServices();
  const dashboardsState = scopeServices?.scopesDashboardsService.state;
  useObservable(scopeServices?.scopesDashboardsService.stateObservable ?? EMPTY_OBSERVABLE, dashboardsState);

  // `loading` must gate this too: fetchDashboards() writes the new scope's forScopeNames and
  // loading:true synchronously, but leaves the *previous* scope's scopeNavigations in
  // place until the fetch resolves. Without this, that stale leftover data reads as "the new scope
  // has content" and can force-open the menu before we actually know whether it does.
  const scopeContentKey =
    dashboardsState && !dashboardsState.loading && dashboardsState.forScopeNames.length > 0
      ? JSON.stringify(dashboardsState.forScopeNames)
      : null;
  const hasScopedDashboardsContent = Boolean(
    scopeContentKey && dashboardsState && dashboardsState.scopeNavigations.length > 0
  );

  // Tracks the key for the content we've last seen - null when there's currently none - so that
  // clearing scopes and then re-applying the *same* one is treated as fresh content (the service
  // really does clear and re-fetch for that), while simply returning to a still-applied scope isn't
  // (fetchDashboards never re-runs for scopes that haven't changed, so this key never moves either).
  const lastContentKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // Chromeless defaults true for a tick before the chrome/nav model resolves on mount, and a
    // non-scoped page never resolves `showAsEnabled` to true at all - in both cases we don't know
    // whether this content is even relevant here, so skip without touching `lastContentKeyRef`.
    // Marking it "seen" here would permanently suppress a real open once chromeless/enabled settles
    // to their real values on a later render, since the key wouldn't have changed since.
    if (chromeless || !showAsEnabled) {
      return;
    }

    if (
      hasScopedDashboardsContent &&
      scopeContentKey !== lastContentKeyRef.current &&
      !isTypingInEditableField() &&
      !chrome.state.getValue().megaMenuOpen
    ) {
      // Never persist this to the docked-open localStorage preference (2nd arg false) - this is an
      // ambient suggestion, not the user choosing to keep the menu open going forward.
      chrome.setMegaMenuOpen(true, false);
    }
    lastContentKeyRef.current = scopeContentKey;
  }, [chromeless, showAsEnabled, hasScopedDashboardsContent, scopeContentKey, chrome]);
}

/**
 * Renders nothing - just mounts `useAutoOpenMegaMenuForScopedContent`. AppChrome mounts this
 * conditionally (only when the mega menu flag is on) rather than calling the hook unconditionally,
 * so the scopes-dashboards-service subscription above - and the re-renders it would otherwise cause
 * on every emission - don't exist at all on the flag-off path.
 */
export function AutoOpenMegaMenuForScopedContent({ chrome }: { chrome: AppChromeService }) {
  useAutoOpenMegaMenuForScopedContent(chrome);
  return null;
}
