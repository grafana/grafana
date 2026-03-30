import {
  LocalValueVariable,
  type MultiValueVariableState,
  type SceneObject,
  type SceneVariable,
  type SceneVariables,
  SceneVariableSet,
  type VariableValueSingle,
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

/**
 * Walk up the scene graph to find the nearest ancestor (or self) that is a repeat clone,
 * then return its repeat source key so the caller can resolve the original object.
 */
export function getRepeatCloneSourceKey(scene: SceneObject): string | undefined {
  let obj: SceneObject | undefined = scene;

  do {
    if ('repeatSourceKey' in obj.state && obj.state.repeatSourceKey) {
      return String(obj.state.repeatSourceKey);
    }
    obj = obj.parent;
  } while (obj);

  return undefined;
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
        properties: variable.state.options.find((o) => o.value === value)?.properties,
        isMulti: variable.state.isMulti,
        includeAll: variable.state.includeAll,
      }),
    ],
  });
}

export function getRepeatVariableValueSet(
  variable: SceneVariable<MultiValueVariableState>,
  value: VariableValueSingle,
  text: VariableValueSingle,
  baseSet?: SceneVariableSet
): SceneVariableSet {
  const localSet = getLocalVariableValueSet(variable, value, text);
  const localVariables = localSet.state.variables.map((v) => v.clone());
  if (!baseSet) {
    return new SceneVariableSet({ variables: localVariables });
  }

  return new SceneVariableSet({
    // Always clone base variables to avoid attaching the same SceneObject instance
    // to multiple SceneVariableSet parents during repeat updates.
    variables: [...baseSet.state.variables.map((v) => v.clone()), ...localVariables],
  });
}

export function removeRepeatLocalVariableFromSet(
  variableSet: SceneVariables | undefined,
  repeatVariableName: string | undefined
): SceneVariables | undefined {
  if (!repeatVariableName || !(variableSet instanceof SceneVariableSet)) {
    return variableSet;
  }

  const variables = variableSet.state.variables.filter(
    (variable) => !(variable instanceof LocalValueVariable && variable.state.name === repeatVariableName)
  );

  if (variables.length === 0) {
    return undefined;
  }

  return new SceneVariableSet({ variables: variables.map((variable) => variable.clone()) });
}
