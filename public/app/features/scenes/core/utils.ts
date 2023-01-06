import { SceneObjectBase } from './SceneObjectBase';
import { SceneObjectState, SceneObjectStatePlain } from './types';

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

/**
 * Will create new SceneItem with shalled cloned state, but all states items of type SceneObject are deep cloned
 */
export function cloneSceneObject<T extends SceneObjectBase<TState>, TState extends SceneObjectState>(
  sceneObject: SceneObjectBase<TState>,
  withState?: Partial<TState>
): T {
  const clonedState = { ...sceneObject.state };

  // Clone any SceneItems in state
  for (const key in clonedState) {
    const propValue = clonedState[key];
    if (propValue instanceof SceneObjectBase) {
      clonedState[key] = propValue.clone();
    }

    // Clone scene objects in arrays
    if (Array.isArray(propValue)) {
      const newArray: any = [];
      for (const child of propValue) {
        if (child instanceof SceneObjectBase) {
          newArray.push(child.clone());
        } else {
          newArray.push(child);
        }
      }
      clonedState[key] = newArray;
    }
  }

  Object.assign(clonedState, withState);

  return new (sceneObject.constructor as any)(clonedState);
}
