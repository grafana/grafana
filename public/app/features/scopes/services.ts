import { config } from '@grafana/runtime';

import { ScopesDashboardsService } from './internal/ScopesDashboardsService';
import { ScopesSelectorService } from './internal/ScopesSelectorService';
import { ScopesService } from './internal/ScopesService';

let scopesService: ScopesService | undefined = undefined;
let scopesSelectorService: ScopesSelectorService | undefined = undefined;
let scopesDashboardsService: ScopesDashboardsService | undefined = undefined;

export function initializeScopesServices() {
  if (config.featureToggles.scopeFilters) {
    scopesService = new ScopesService();
    scopesSelectorService = new ScopesSelectorService();
    scopesDashboardsService = new ScopesDashboardsService();
  }
}

export function getScopesService(): ScopesService | undefined {
  return scopesService;
}

export function getScopesSelectorService(): ScopesSelectorService | undefined {
  return scopesSelectorService;
}

export function getScopesDashboardsService(): ScopesDashboardsService | undefined {
  return scopesDashboardsService;
}
