import { config, locationService } from '@grafana/runtime';

export function getScopesFromUrl(): URLSearchParams | undefined {
  if (!config.featureToggles.scopeFilters || !config.featureToggles.passScopeToDashboardApi) {
    return undefined;
  }

  const queryParams = locationService.getSearchObject();
  const rawScopes = queryParams['scopes'] ?? [];
  const scopes = Array.isArray(rawScopes) ? rawScopes : [rawScopes];

  return new URLSearchParams(scopes.map((scope) => ['scopes', String(scope)]));
}
