import { SceneObject, VizPanel, sceneGraph, PATH_ID_SEPARATOR } from '@grafana/scenes';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

import { getVizPanelKeyForPanelId } from './utils';

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

export function getSceneObjectSelectionPathId(sceneObject: SceneObject): string {
  const path: string[] = [];
  let current: SceneObject | undefined = sceneObject;
  while (current) {
    const { key } = current.state;
    if (key) {
      path.unshift(key);
    }
    current = current.parent;
  }
  return path.join(PATH_ID_SEPARATOR);
}

export function findObjectBySelectionPathId(scene: SceneObject, pathId: string): SceneObject | null {
  let panelPathId = pathId;
  if (/^\d+$/.test(pathId)) {
    panelPathId = getVizPanelKeyForPanelId(parseInt(pathId, 10));
  }

  const found = sceneGraph.findObject(scene, (obj) => {
    if (obj instanceof VizPanel) {
      return obj.getPathId() === panelPathId;
    }

    if (obj instanceof RowItem || obj instanceof TabItem) {
      return getSceneObjectSelectionPathId(obj) === pathId;
    }

    return false;
  });

  return found instanceof VizPanel || found instanceof RowItem || found instanceof TabItem ? found : null;
}

export function containsPathIdSeparator(key: string): boolean {
  return key.includes(PATH_ID_SEPARATOR);
}
