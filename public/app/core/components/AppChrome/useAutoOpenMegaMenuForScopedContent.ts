import { useEffect, useRef } from 'react';
import { Observable } from 'rxjs';

import { useObservable } from '@grafana/data/unstable';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';

import { type AppChromeService } from './AppChromeService';

/**
 * Opens a closed mega menu the moment scoped suggested dashboards become available, so the user
 * isn't left wondering why nothing happened after applying a scope. Lives here rather than inside
 * ScopesDashboardsMegaMenuSection because that component only mounts while the mega menu is already
 * open (both the docked and overlay render paths unmount it on close) - it can never react to new
 * content in order to open a *closed* menu.
 */
export function useAutoOpenMegaMenuForScopedContent(
  chrome: AppChromeService,
  chromeless: boolean | undefined,
  scopesMegaMenuEnabled: boolean
) {
  const scopeServices = useScopesServices();
  const dashboardsState = scopeServices?.scopesDashboardsService.state;
  useObservable(scopeServices?.scopesDashboardsService.stateObservable ?? new Observable(), dashboardsState);

  // `loading` must gate this too: fetchDashboards() writes the new scope's forScopeNames and
  // loading:true synchronously, but leaves the *previous* scope's dashboards/scopeNavigations in
  // place until the fetch resolves. Without this, that stale leftover data reads as "the new scope
  // has content" and can force-open the menu before we actually know whether it does.
  //
  // Deliberately doesn't factor in whether scopes are currently enabled: ScopesSelectorService only
  // ever calls fetchDashboards() as a result of an actual scope-apply action (ScopesSelectorService.ts,
  // applyScopes), never as a side effect of the enabled flag itself flipping - so this data can't change
  // during the transient `enabled` flap from navigating between pages (grafana/hyperion-planning#677).
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
    // Only act - and only remember what we've seen - while we're actually allowed to open the menu.
    // Otherwise content arriving while chromeless/the flag is off would get marked "seen" without
    // ever opening anything, and the real transition would be missed once we become eligible again
    // (e.g. chromeless resolving to false right after mount).
    const canAutoOpen = !chromeless && scopesMegaMenuEnabled;
    if (canAutoOpen && hasScopedDashboardsContent && scopeContentKey !== lastContentKeyRef.current) {
      chrome.setMegaMenuOpen(true, true);
    }
    if (canAutoOpen) {
      lastContentKeyRef.current = scopeContentKey;
    }
  }, [chromeless, scopesMegaMenuEnabled, hasScopedDashboardsContent, scopeContentKey, chrome]);
}
