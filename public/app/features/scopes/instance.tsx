import { config } from '@grafana/runtime';
import { UrlSyncManager } from '@grafana/scenes';

import { ScopesScene } from './internal/ScopesScene';

export let scopesScene: ScopesScene | null = null;

if (config.featureToggles.scopeFilters) {
  scopesScene = new ScopesScene();
  const urlSyncManager = new UrlSyncManager();
  urlSyncManager.initSync(scopesScene!);
}

export function renderScopes() {
  if (!scopesScene) {
    return null;
  }

  return <scopesScene.Component model={scopesScene} />;
}

export function renderScopesDashboards() {
  if (!scopesScene) {
    return null;
  }

  return <scopesScene.state.dashboards.Component model={scopesScene.state.dashboards} />;
}
