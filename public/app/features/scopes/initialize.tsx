import { config, setScopesDashboards, setScopesSelector } from '@grafana/runtime';
import { UrlSyncManager } from '@grafana/scenes';

import { ScopesDashboardsScene } from './internal/ScopesDashboardsScene';
import { ScopesSelectorScene } from './internal/ScopesSelectorScene';

export function initializeScopes() {
  if (config.featureToggles.scopeFilters) {
    const scopesSelectorScene = new ScopesSelectorScene();
    const scopesDashboardsScene = new ScopesDashboardsScene();

    scopesSelectorScene.setState({ dashboards: scopesDashboardsScene.getRef() });
    scopesDashboardsScene.setState({ selector: scopesSelectorScene.getRef() });

    setScopesSelector(scopesSelectorScene);
    setScopesDashboards(scopesDashboardsScene);

    const urlSyncManager = new UrlSyncManager();
    urlSyncManager.initSync(scopesSelectorScene!);
  }
}
