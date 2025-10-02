import {
  LocalValueVariable,
  MultiValueVariableState,
  SceneObject,
  SceneVariable,
  SceneVariableSet,
  VariableValueSingle,
} from '@grafana/scenes';

const CLONE_KEY = '-clone-';

/**
 * Create or alter the last key for a key
 * @param key
 * @param index
 */
export function getCloneKey(key: string, index: number): string {
  return `${key}${CLONE_KEY}${index}`;
}

export function isRepeatCloneOrChildOf(scene: SceneObject): boolean {
  let obj: SceneObject | undefined = scene;

  do {
    if ('repeatSourceKey' in obj.state && obj.state.repeatSourceKey) {
      return true;
    }

    obj = obj.parent;
  } while (obj);

  return false;
}

export function getLocalVariableValueSet(
  variable: SceneVariable<MultiValueVariableState>,
  value: VariableValueSingle,
  text: VariableValueSingle
): SceneVariableSet {
  return new SceneVariableSet({
    variables: [
      new LocalValueVariable({
        name: variable.state.name,
        value,
        text,
        isMulti: variable.state.isMulti,
        includeAll: variable.state.includeAll,
      }),
    ],
  });
}
