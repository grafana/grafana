import { useCallback, useMemo } from 'react';

import { useScopesServices } from '../ScopesContextProvider';
import { useScopesServiceState } from '../useScopesServiceState';

import { DEFAULT_DASHBOARDS_STATE, type ScopesDashboardsServiceState } from './ScopesDashboardsService';
import { type ScopeNavigation, type SuggestedNavigationsFoldersMap } from './types';

/**
 * Reads one field of the dashboards navigation state. Every state hook below passes the service state through
 * unchanged, so what a consumer receives is the same value it would get from the service. See
 * `useScopesServiceState` for what `select` must return.
 *
 * Only top-level fields are exposed. The service changes the folder objects below the top level in place, so a hook
 * that selected one of them would not rerender.
 */
function useDashboardsState<T>(select: (state: ScopesDashboardsServiceState) => T): T {
  const service = useScopesServices()?.scopesDashboardsService;
  return useScopesServiceState(service, DEFAULT_DASHBOARDS_STATE, select);
}

/** Whether the navigations for the current scopes are being fetched. */
export function useDashboardsLoading(): boolean {
  return useDashboardsState((state) => state.loading);
}

/**
 * The scope names the navigations were requested for. While a fetch is in flight this already holds the new names
 * and `useScopeNavigations` still holds the previous result, so read `useDashboardsLoading` before trusting the pair.
 */
export function useForScopeNames(): string[] {
  return useDashboardsState((state) => state.forScopeNames);
}

/** The raw navigations returned for `forScopeNames`. */
export function useScopeNavigations(): ScopeNavigation[] {
  return useDashboardsState((state) => state.scopeNavigations);
}

/**
 * The folder tree with the search query applied. Every folder carries its own `expanded` and `loading` flags, and
 * the tree components read them from props.
 */
export function useFilteredFolders(): SuggestedNavigationsFoldersMap {
  return useDashboardsState((state) => state.filteredFolders);
}

/** The text typed in the search box above the folder tree. `useFilteredFolders` already has it applied. */
export function useDashboardsSearchQuery(): string {
  return useDashboardsState((state) => state.searchQuery);
}

/**
 * The navigation actions. The returned object keeps its identity while the service does, and each function looks the
 * service method up when it is called.
 *
 * `setNavigationScope` is a temporary pass-through. It returns the service's promise, which settles after the
 * dashboards are fetched, and callers apply scopes after it. It goes away when the URL becomes the only owner of the
 * navigation scope and its path, and the callers move to a single URL write. The service's `fallbackScopeNames`
 * argument is not exposed here, because only the scopes services call it, and they call the service directly.
 */
export function useScopesDashboardsActions() {
  const service = useScopesServices()?.scopesDashboardsService;

  return useMemo(
    () => ({
      changeSearchQuery: (searchQuery: string) => service?.changeSearchQuery?.(searchQuery),
      clearSearchQuery: () => service?.clearSearchQuery?.(),
      updateFolder: (path: string[], expanded: boolean) => service?.updateFolder?.(path, expanded),
      setNavigationScope: (navigationScope?: string, navScopePath?: string[]) =>
        service?.setNavigationScope?.(navigationScope, undefined, navScopePath) ?? Promise.resolve(),
    }),
    [service]
  );
}

/**
 * Returns a function that reads the navigation scope and its path at the moment it is called. Click handlers use it
 * so they see the latest values without subscribing the component to them, which would add renders and let a handler
 * close over stale values.
 */
export function useGetNavigationScope() {
  const service = useScopesServices()?.scopesDashboardsService;

  return useCallback(
    () => ({ navigationScope: service?.state?.navigationScope, navScopePath: service?.state?.navScopePath }),
    [service]
  );
}
