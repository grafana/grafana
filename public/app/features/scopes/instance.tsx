import { config } from '@grafana/runtime';
import { UrlSyncManager } from '@grafana/scenes';

import { ScopesDashboardsScene } from './internal/ScopesDashboardsScene';
import { ScopesFiltersScene } from './internal/ScopesFiltersScene';

export let scopesDashboardsScene: ScopesDashboardsScene | null = null;
export let scopesFiltersScene: ScopesFiltersScene | null = null;

export function initializeScopes() {
  if (config.featureToggles.scopeFilters) {
    scopesFiltersScene = new ScopesFiltersScene();
    scopesDashboardsScene = new ScopesDashboardsScene();

    scopesFiltersScene.setState({ dashboards: scopesDashboardsScene.getRef() });
    scopesDashboardsScene.setState({ filters: scopesFiltersScene.getRef() });

    const urlSyncManager = new UrlSyncManager();
    urlSyncManager.initSync(scopesFiltersScene!);
  }
}
