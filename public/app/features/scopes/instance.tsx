import { config } from '@grafana/runtime';

import { ScopesDashboardsScene } from './internal/ScopesDashboardsScene';
import { ScopesSelectorScene } from './internal/ScopesSelectorScene';

export let scopesDashboardsScene: ScopesDashboardsScene | null = null;
export let scopesSelectorScene: ScopesSelectorScene | null = null;

export function initializeScopes() {
  if (config.featureToggles.scopeFilters) {
    scopesSelectorScene = new ScopesSelectorScene();
    scopesDashboardsScene = new ScopesDashboardsScene();

    scopesSelectorScene.setState({ dashboards: scopesDashboardsScene.getRef() });
    scopesDashboardsScene.setState({ selector: scopesSelectorScene.getRef() });
  }
}
