import { sceneGraph, type SceneObject, VizPanel } from '@grafana/scenes';
import { getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/getVizPanelKeyForPanelId';

/**
 * This will also try lookup based on panelId
 */
export function findVizPanelByKey(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  const panel = findVizPanelInternal(scene, key);
  if (panel) {
    return panel;
  }

  // Also try to find by panel id
  const id = parseInt(key, 10);
  if (isNaN(id)) {
    return null;
  }

  return findVizPanelInternal(scene, getVizPanelKeyForPanelId(id));
}

function findVizPanelInternal(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  const panel = sceneGraph.findObject(scene, (obj) => {
    const objKey = obj.state.key!;

    if (objKey === key) {
      return true;
    }

    if (!(obj instanceof VizPanel)) {
      return false;
    }

    return false;
  });

  if (panel) {
    if (panel instanceof VizPanel) {
      return panel;
    } else {
      throw new Error(`Found panel with key ${key} but it was not a VizPanel`);
    }
  }

  return null;
}
