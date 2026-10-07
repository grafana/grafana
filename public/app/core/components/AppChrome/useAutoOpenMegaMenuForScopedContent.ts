import { useEffect, useRef } from 'react';
import { Observable } from 'rxjs';

import { useObservable } from '@grafana/data/unstable';
import { useScopes } from '@grafana/runtime';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { useDebouncedScopesEnabled } from 'app/features/scopes/useDebouncedScopesEnabled';

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
  const scopes = useScopes();
  const scopeServices = useScopesServices();
  const dashboardsState = scopeServices?.scopesDashboardsService.state;
  useObservable(scopeServices?.scopesDashboardsService.stateObservable ?? new Observable(), dashboardsState);

  // Debounced so a transient `enabled` flap during navigation (grafana/hyperion-planning#677)
  // doesn't read as "scopes just got disabled" and later misread stale leftover dashboards state
  // as new content, force-opening the menu on an unrelated, non-scoped page.
  const scopesEnabled = useDebouncedScopesEnabled(scopes?.state.enabled ?? false);

  // `loading` must gate this too: fetchDashboards() writes the new scope's forScopeNames and
  // loading:true synchronously, but leaves the *previous* scope's dashboards/scopeNavigations in
  // place until the fetch resolves. Without this, that stale leftover data reads as "the new scope
  // has content" and can force-open the menu before we actually know whether it does.
  const hasScopedDashboardsContent = Boolean(
    scopesEnabled &&
      dashboardsState &&
      !dashboardsState.loading &&
      dashboardsState.forScopeNames.length > 0 &&
      (dashboardsState.dashboards.length > 0 || dashboardsState.scopeNavigations.length > 0)
  );

  const hadScopedDashboardsContentRef = useRef(false);
  useEffect(() => {
    // Only track "have we already reacted to this content" while we're actually allowed to open
    // the menu. Otherwise, content arriving while chromeless/the flag is off would get marked as
    // "seen" without ever opening anything, and the real transition would be missed once we become
    // eligible again (e.g. chromeless resolving to false right after mount).
    const canAutoOpen = !chromeless && scopesMegaMenuEnabled;
    if (canAutoOpen && hasScopedDashboardsContent && !hadScopedDashboardsContentRef.current) {
      chrome.setMegaMenuOpen(true, true);
    }
    if (canAutoOpen) {
      hadScopedDashboardsContentRef.current = hasScopedDashboardsContent;
    }
  }, [chromeless, scopesMegaMenuEnabled, hasScopedDashboardsContent, chrome]);
}
