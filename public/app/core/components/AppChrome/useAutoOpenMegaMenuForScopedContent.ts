import { useEffect, useRef } from 'react';
import { Observable } from 'rxjs';

import { useObservable } from '@grafana/data/unstable';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';

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
 * Only mounted (via `AutoOpenMegaMenuForScopedContent` below) while the mega menu flag is on and the
 * page isn't chromeless, so there's no separate gating to do here - whenever this runs, opening the
 * menu is allowed.
 */
function useAutoOpenMegaMenuForScopedContent(chrome: AppChromeService) {
  const scopeServices = useScopesServices();
  const dashboardsState = scopeServices?.scopesDashboardsService.state;
  useObservable(scopeServices?.scopesDashboardsService.stateObservable ?? EMPTY_OBSERVABLE, dashboardsState);

  // `loading` must gate this too: fetchDashboards() writes the new scope's forScopeNames and
  // loading:true synchronously, but leaves the *previous* scope's dashboards/scopeNavigations in
  // place until the fetch resolves. Without this, that stale leftover data reads as "the new scope
  // has content" and can force-open the menu before we actually know whether it does.
  //
  // Deliberately doesn't factor in whether scopes are currently enabled: ScopesSelectorService only
  // ever calls fetchDashboards() as a result of an actual scope-apply action (ScopesSelectorService.ts,
  // applyScopes), never as a side effect of the enabled flag itself flipping - so this data can't change
  // during the transient `enabled` flap from navigating between pages.
  const scopeContentKey =
    dashboardsState && !dashboardsState.loading && dashboardsState.forScopeNames.length > 0
      ? JSON.stringify(dashboardsState.forScopeNames)
      : null;
  const hasScopedDashboardsContent = Boolean(
    scopeContentKey &&
      dashboardsState &&
      (dashboardsState.dashboards.length > 0 || dashboardsState.scopeNavigations.length > 0)
  );

  // Tracks the key for the content we've last seen - null when there's currently none - so that
  // clearing scopes and then re-applying the *same* one is treated as fresh content (the service
  // really does clear and re-fetch for that), while simply returning to a still-applied scope isn't
  // (fetchDashboards never re-runs for scopes that haven't changed, so this key never moves either).
  const lastContentKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (hasScopedDashboardsContent && scopeContentKey !== lastContentKeyRef.current && !isTypingInEditableField()) {
      // Never persist this to the docked-open localStorage preference (2nd arg false) - this is an
      // ambient suggestion, not the user choosing to keep the menu open going forward.
      chrome.setMegaMenuOpen(true, false);
    }
    lastContentKeyRef.current = scopeContentKey;
  }, [hasScopedDashboardsContent, scopeContentKey, chrome]);
}

/**
 * Renders nothing - just mounts `useAutoOpenMegaMenuForScopedContent`. AppChrome mounts this
 * conditionally (only when the mega menu flag is on and the page isn't chromeless) rather than
 * calling the hook unconditionally, so the scopes-dashboards-service subscription above - and the
 * re-renders it would otherwise cause on every emission - don't exist at all on the flag-off path.
 */
export function AutoOpenMegaMenuForScopedContent({ chrome }: { chrome: AppChromeService }) {
  useAutoOpenMegaMenuForScopedContent(chrome);
  return null;
}
