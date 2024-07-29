import { Scope } from '@grafana/data';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { ScopesFacade } from './ScopesFacadeScene';
import { scopesDashboardsScene, scopesFiltersScene } from './instance';
import { getScopesFromSelectedScopes } from './internal/utils';

export function getSelectedScopes(): Scope[] {
  return getScopesFromSelectedScopes(scopesFiltersScene?.state.scopes ?? []);
}

export function getSelectedScopesNames(): string[] {
  return getSelectedScopes().map((scope) => scope.metadata.name);
}

export function enableScopes() {
  scopesFiltersScene?.enable();
  scopesDashboardsScene?.enable();
}

export function disableScopes() {
  scopesFiltersScene?.disable();
  scopesDashboardsScene?.disable();
}

export function exitScopesReadOnly() {
  scopesFiltersScene?.exitReadOnly();
  scopesDashboardsScene?.enable();
}

export function enterScopesReadOnly() {
  scopesFiltersScene?.enterReadOnly();
  scopesDashboardsScene?.disable();
}

export function getClosestScopesFacade(scene: SceneObject): ScopesFacade | null {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return sceneGraph.findObject(scene, (obj) => obj instanceof ScopesFacade) as ScopesFacade | null;
}
