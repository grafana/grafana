import {
  LocalValueVariable,
  type MultiValueVariableState,
  type SceneObject,
  SceneObjectBase,
  type SceneVariable,
  type SceneVariables,
  SceneVariableSet,
  type VariableValueSingle,
} from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';

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

/**
 * Resolve an object inside a repeat clone to the same object in the repeat source.
 * Repeat clones are rebuilt from the source on every edit, so edits made on a clone are discarded.
 * Clone rows/tabs live in the source's repeatedRows/repeatedTabs, so the source is the clone's parent,
 * and the clone subtree mirrors the source subtree by state property and array index.
 */
export function getRepeatSourceObject<T extends SceneObject>(obj: T): T {
  const path: Array<{ prop: string; index?: number }> = [];
  let current: SceneObject = obj;

  while (current.parent) {
    const parent: SceneObject = current.parent;
    const repeatSourceKey = 'repeatSourceKey' in current.state ? current.state.repeatSourceKey : undefined;

    if (repeatSourceKey && parent.state.key === repeatSourceKey) {
      const resolved = followStatePath(parent, path);
      // The source may itself sit inside another repeat clone (e.g. a repeated row in a repeated tab)
      return isSameType(obj, resolved) ? getRepeatSourceObject(resolved) : obj;
    }

    const step = findStateLocation(parent, current);
    if (!step) {
      return obj;
    }

    path.unshift(step);
    current = parent;
  }

  return obj;
}

function isSameType<T extends SceneObject>(obj: T, candidate: unknown): candidate is T {
  return candidate instanceof obj.constructor;
}

function findStateLocation(parent: SceneObject, child: SceneObject): { prop: string; index?: number } | undefined {
  for (const [prop, value] of Object.entries(parent.state)) {
    if (value === child) {
      return { prop };
    }
    if (Array.isArray(value)) {
      const index = value.indexOf(child);
      if (index !== -1) {
        return { prop, index };
      }
    }
  }

  return undefined;
}

function followStatePath(root: SceneObject, path: Array<{ prop: string; index?: number }>): unknown {
  let current: unknown = root;

  for (const { prop, index } of path) {
    if (!(current instanceof SceneObjectBase)) {
      return undefined;
    }
    const value: unknown = Reflect.get(current.state, prop);
    current = index === undefined ? value : Array.isArray(value) ? value[index] : undefined;
  }

  return current;
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

/**
 * Deep-clone a section annotation set so duplicated rows/tabs get their own layer objects.
 * Scene clone keeps keys, and a shared key makes sidebar selection resolve to the first layer.
 */
export function cloneSectionDataLayerSet(data: SceneObject | undefined): DashboardDataLayerSet | undefined {
  if (!(data instanceof DashboardDataLayerSet)) {
    return undefined;
  }

  return data.clone({
    key: undefined,
    annotationLayers: data.state.annotationLayers.map((layer) => layer.clone({ key: undefined })),
  });
}

/**
 * Deep-clone a section-scoped variable set so duplicated rows/tabs get unique scene keys.
 * Without new keys, sidebar selection resolves to the first variable with a matching key.
 */
export function cloneSectionVariableSet(variableSet: SceneVariables | undefined): SceneVariableSet | undefined {
  if (!(variableSet instanceof SceneVariableSet)) {
    return undefined;
  }

  return variableSet.clone({
    key: undefined,
    variables: variableSet.state.variables.map((variable) => variable.clone({ key: undefined })),
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
