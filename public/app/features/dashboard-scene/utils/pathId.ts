import { type SceneObject, VizPanel, sceneGraph } from '@grafana/scenes';
import { getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/getVizPanelKeyForPanelId';

export function findVizPanelByPathId(scene: SceneObject, pathId: string): VizPanel | null {
  // Check if pathId is just an old legacy panel id
  if (/^\d+$/.test(pathId)) {
    pathId = getVizPanelKeyForPanelId(parseInt(pathId, 10));
  }

  const panel = sceneGraph.findObject(scene, (obj) => {
    if (!(obj instanceof VizPanel)) {
      return false;
    }

    return pathId === obj.getPathId();
  });

  if (panel) {
    if (panel instanceof VizPanel) {
      return panel;
    } else {
      throw new Error(`Found panel with key ${pathId} but it was not a VizPanel`);
    }
  }

  return null;
}
