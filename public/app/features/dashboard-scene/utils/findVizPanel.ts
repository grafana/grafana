import { sceneGraph, SceneObject, VizPanel } from '@grafana/scenes';

export function findVizPanel(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  const obj = sceneGraph.findObject(scene, (obj) => obj.state.key === key);
  if (obj instanceof VizPanel) {
    return obj;
  }

  return null;
}
