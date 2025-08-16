import { SceneObject, VizPanel, sceneGraph, LocalValueVariable } from '@grafana/scenes';

import { getVizPanelKeyForPanelId } from './utils';

const PATH_ID_SEPARATOR = '$';

export function findVizPanelByPathId(scene: SceneObject, pathId: string): VizPanel | null {
  // Check if pathId is just an old legacy panel id
  if (/^\d+$/.test(pathId)) {
    pathId = getVizPanelKeyForPanelId(parseInt(pathId, 10));
  }

  const panel = sceneGraph.findObject(scene, (obj) => {
    if (!(obj instanceof VizPanel)) {
      return false;
    }

    return pathId === getVizPanelPathId(obj);
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

/**
 * Returns a unique path for a given VizPanel based on the panels peristance id and any local variable value contexts.
 * This is used to create a unique URL key identifiers for panels and repeated panels.
 */
export function getVizPanelPathId(panel: VizPanel): string {
  let pathId = `panel-${panel.getLegacyPanelId()}`;
  let sceneObj: SceneObject | undefined = panel;
  let lastName: string | undefined;

  while (sceneObj) {
    const variables = sceneObj.state.$variables;
    if (variables) {
      variables.state.variables.forEach((variable) => {
        if (variable.state.name === lastName) {
          // Skip if the variable name is the same as the last one
          // This happens as the source row has a local variable value and the child repeats
          return;
        }

        if (variable instanceof LocalValueVariable) {
          pathId = `${variable.state.value}${PATH_ID_SEPARATOR}${pathId}`;
          lastName = variable.state.name;
        }
      });
    }

    sceneObj = sceneObj.parent;
  }

  return pathId;
}

export function containsPathIdSeparator(key: string): boolean {
  return key.includes(PATH_ID_SEPARATOR);
}
