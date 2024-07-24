import { Scope } from '@grafana/data';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { ScopesFacade } from './ScopesFacadeScene';
import { scopesDashboardsScene, scopesFiltersScene } from './instance';
import { getScopesFromSelectedScopes } from './internal/utils';

export function getSelectedScopes(): Scope[] {
  return getScopesFromSelectedScopes(scopesFiltersScene?.state.scopes ?? []);
}

export function showScopes() {
  scopesFiltersScene?.show();
  scopesDashboardsScene?.show();
}

export function hideScopes() {
  scopesFiltersScene?.hide();
  scopesDashboardsScene?.hide();
}

export function enableScopes() {
  scopesFiltersScene?.enable();
  scopesDashboardsScene?.show();
}

export function disableScopes() {
  scopesFiltersScene?.disable();
  scopesDashboardsScene?.hide();
}

export function getClosestScopesFacade(scene: SceneObject): ScopesFacade | null {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return sceneGraph.findObject(scene, (obj) => obj instanceof ScopesFacade) as ScopesFacade | null;
}
