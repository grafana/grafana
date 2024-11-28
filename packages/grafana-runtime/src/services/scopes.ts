import { ScopesDashboardsService } from './ScopesDashboardsService';
import { ScopesSelectorService } from './ScopesSelectorService';

export let scopesSelectorService: ScopesSelectorService;
export let scopesDashboardsService: ScopesDashboardsService;

export function initializeScopes() {
  scopesSelectorService = new ScopesSelectorService();
  scopesDashboardsService = new ScopesDashboardsService();
}

export function getScopesSelectorService(): ScopesSelectorService {
  return scopesSelectorService;
}

export function getScopesDashboardsService(): ScopesDashboardsService {
  return scopesDashboardsService;
}
