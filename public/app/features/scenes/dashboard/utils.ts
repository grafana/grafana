import { SceneDeactivationHandler, SceneObject, SceneObjectBase, SceneObjectStatePlain } from '@grafana/scenes';

export function getVizPanelKeyForPanelId(panelId: number) {
  return `panel-${panelId}`;
}

/**
 * Useful from tests to simulate mounting a full scene. Children are activated before parents to simulate the real order
 * of React mount order and useEffect ordering.
 *
 */
export function activateAllSceneObjects(scene: SceneObject): SceneDeactivationHandler {
  const deactivationHandlers: SceneDeactivationHandler[] = [];

  forEachSceneObjectInState(scene.state, (child) => {
    deactivationHandlers.push(activateAllSceneObjects(child));
  });

  //deactivationHandlers.push(scene.activate());

  return () => {
    for (const handler of deactivationHandlers) {
      handler();
    }
  };
}

/**
 * Will call callback for all first level child scene objects and scene objects inside arrays
 */
export function forEachSceneObjectInState(state: SceneObjectStatePlain, callback: (scene: SceneObjectBase) => void) {
  for (const propValue of Object.values(state)) {
    if (propValue instanceof SceneObjectBase) {
      callback(propValue);
    }

    if (Array.isArray(propValue)) {
      for (const child of propValue) {
        if (child instanceof SceneObjectBase) {
          callback(child);
        }
      }
    }
  }
}
