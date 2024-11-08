import { Scope } from '@grafana/data';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { ScopesFacade } from '../components/ScopesFacadeScene';
import { getScopesDashboards, getScopesSelector } from '../services';

export function getSelectedScopes(): Scope[] {
  return (getScopesSelector()?.state.scopes ?? []).map(({ scope }) => scope);
}

export function getSelectedScopesNames(): string[] {
  return getSelectedScopes().map((scope) => scope.metadata.name);
}

export function enableScopes() {
  getScopesSelector()?.enable();
  getScopesDashboards()?.enable();
}

export function disableScopes() {
  getScopesSelector()?.disable();
  getScopesDashboards()?.disable();
}

export function exitScopesReadOnly() {
  getScopesSelector()?.exitReadOnly();
  getScopesDashboards()?.exitReadOnly();
}

export function enterScopesReadOnly() {
  getScopesSelector()?.enterReadOnly();
  getScopesDashboards()?.enterReadOnly();
}

export function getClosestScopesFacade(scene: SceneObject): ScopesFacade | null {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return sceneGraph.findObject(scene, (obj) => obj instanceof ScopesFacade) as ScopesFacade | null;
}

export const useScopesDashboardsState = () => {
  return getScopesDashboards()?.useState();
};
