import { type SceneObject, sceneGraph, VizPanel } from '@grafana/scenes';

export function getVizPanelKeyForPanelId(panelId: number) {
  return `panel-${panelId}`;
}

export function findVizPanelByKey(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  const panel = findVizPanelInternal(scene, key);
  if (panel) {
    return panel;
  }

  const id = parseInt(key, 10);
  if (isNaN(id)) {
    return null;
  }

  return findVizPanelInternal(scene, getVizPanelKeyForPanelId(id));
}

function findVizPanelInternal(scene: SceneObject, key: string): VizPanel | null {
  const panel = sceneGraph.findObject(scene, (obj) => obj.state.key === key);

  if (!panel) {
    return null;
  }

  if (panel instanceof VizPanel) {
    return panel;
  }

  throw new Error(`Found panel with key ${key} but it was not a VizPanel`);
}
