import { sceneGraph, SceneObject } from '@grafana/scenes';

import { ScopesFacade } from './ScopesFacadeScene';

export function getClosestScopesFacade(scene: SceneObject): ScopesFacade | null {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return sceneGraph.findObject(scene, (obj) => obj instanceof ScopesFacade) as ScopesFacade | null;
}
