import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

// Code that loads at boot imports this module, so it must not import the rest of dashboard-scene.
// Until the page state manager is created and registers here, no dashboards are cached.

interface DashboardPageStateCaches {
  clearDashboardCache(): void;
  clearSceneCache(): void;
  removeSceneCache(cacheKey: string): void;
}

let pageStateCaches: DashboardPageStateCaches | undefined;

export function registerDashboardPageStateCaches(caches: DashboardPageStateCaches): void {
  pageStateCaches = caches;
}

export function clearDashboardsPageCache(dashboardUids: string[]): void {
  if (!pageStateCaches) {
    return;
  }

  pageStateCaches.clearDashboardCache();

  for (const uid of dashboardUids) {
    pageStateCaches.removeSceneCache(uid);
  }
}

export function clearDashboardScenesCache(): void {
  pageStateCaches?.clearSceneCache();
}

export const predefinedVariablesCache = new Map<string, { ts: number; variables: VariableKind[] }>();

export function clearPredefinedVariablesCache(): void {
  predefinedVariablesCache.clear();
}
