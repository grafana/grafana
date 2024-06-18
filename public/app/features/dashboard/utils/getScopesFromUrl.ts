import { config, locationService } from '@grafana/runtime';

export function getScopesFromUrl(): string[] | undefined {
  if (!config.featureToggles.scopeFilters || !config.featureToggles.passScopeToDashboardApi) {
    return undefined;
  }

  const queryParams = locationService.getSearchObject();
  const rawScopes = queryParams['scopes'] ?? [];
  const scopes = Array.isArray(rawScopes) ? rawScopes : [rawScopes];

  return scopes.map(String);
}
