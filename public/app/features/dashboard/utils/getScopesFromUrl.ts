import { config, locationService } from '@grafana/runtime';

export function getScopesFromUrl(): string[] | undefined {
  if (!config.featureToggles.scopeFilters || !config.featureToggles.passScopeToDashboardApi) {
    return undefined;
  }

  const queryParams = locationService.getSearchObject();
  const rawScopes = queryParams['scopes'] ?? [];
  const scopes = Array.isArray(rawScopes) ? rawScopes : [rawScopes];

  // It's extremely important to have the array sorted as we're using this array as a cache key
  // If the scopes are not sorted, then the equality check will fail
  return scopes.map(String).sort();
}
