import { type SceneObject, type SceneVariable, SceneVariableSet } from '@grafana/scenes';

import { keepOnlyUserDefinedVariables } from './variables';

/**
 * Resolves variables visible when editing from `sceneObject` (e.g. repeat options).
 *
 * Walk begins at `sceneObject.parent ?? sceneObject` so a row, tab, or grid item never
 * contributes its own `$variables` — only ancestors (e.g. section above, then dashboard).
 * When `sceneObject` is the scene root (`DashboardScene`), `parent` is undefined and the
 * walk starts at the dashboard, including global variables.
 */
export function collectAncestorSceneVariables(sceneObject: SceneObject): SceneVariable[] {
  const result: SceneVariable[] = [];
  const seenNames = new Set<string>();
  let current: SceneObject | undefined = sceneObject.parent ?? sceneObject;

  while (current) {
    if (current.state.$variables instanceof SceneVariableSet) {
      const variables = current.state.$variables.state.variables.filter(keepOnlyUserDefinedVariables);
      for (const variable of variables) {
        const name = variable.state.name;
        if (!seenNames.has(name)) {
          seenNames.add(name);
          result.push(variable);
        }
      }
    }
    current = current.parent;
  }

  return result;
}

/**
 * Subscribes to state changes on every `SceneVariableSet` along the same walk as
 * {@link collectAncestorSceneVariables} so the UI refreshes when variables change.
 */
export function subscribeAncestorVariableSets(sceneObject: SceneObject, onChange: () => void): () => void {
  let current: SceneObject | undefined = sceneObject.parent ?? sceneObject;

  const unsubs: Array<{ unsubscribe: () => void }> = [];

  while (current) {
    if (current.state.$variables instanceof SceneVariableSet) {
      unsubs.push(current.state.$variables.subscribeToState(onChange));
    }
    current = current.parent;
  }

  return () => {
    unsubs.forEach((u) => u.unsubscribe());
  };
}
