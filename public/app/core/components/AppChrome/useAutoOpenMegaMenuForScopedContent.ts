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
  //
  // Identified by the scope names rather than a plain boolean, so a disable/re-enable cycle for the
  // *same* scope (e.g. navigating to a non-scoped page and back - scopesEnabled debounces the brief
  // `enabled` flap, but a real disable still resolves eventually) doesn't look like new content and
  // force the menu open again, overwriting a preference the user already set by closing it. The old
  // docked drawer this replaces had the same property for free: `drawerOpened` is untouched by the
  // scope selection itself, only by explicit user action or the edit-mode effect.
  const scopeContentKey =
    scopesEnabled && dashboardsState && !dashboardsState.loading && dashboardsState.forScopeNames.length > 0
      ? JSON.stringify(dashboardsState.forScopeNames)
      : null;
  const hasScopedDashboardsContent = Boolean(
    scopeContentKey &&
      dashboardsState &&
      (dashboardsState.dashboards.length > 0 || dashboardsState.scopeNavigations.length > 0)
  );

  const lastOpenedForKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // Only act - and only remember we acted - while we're actually allowed to open the menu.
    // Otherwise content arriving while chromeless/the flag is off would get marked "seen" without
    // ever opening anything, and the real transition would be missed once we become eligible again
    // (e.g. chromeless resolving to false right after mount).
    const canAutoOpen = !chromeless && scopesMegaMenuEnabled;
    if (canAutoOpen && hasScopedDashboardsContent && scopeContentKey !== lastOpenedForKeyRef.current) {
      chrome.setMegaMenuOpen(true, true);
      lastOpenedForKeyRef.current = scopeContentKey;
    }
  }, [chromeless, scopesMegaMenuEnabled, hasScopedDashboardsContent, scopeContentKey, chrome]);
}
