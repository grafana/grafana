/**
 * Variable mutation handlers
 */

import { sceneGraph, SceneVariableSet } from '@grafana/scenes';

import { sceneVariablesSetToSchemaV2Variables } from '../../serialization/sceneVariablesSetToVariables';
import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';
import type { MutationChange, AddVariablePayload, RemoveVariablePayload, UpdateVariablePayload } from '../types';

import { createHandler } from '.';

/**
 * Replace the dashboard's variable set with a new set containing the given variables.
 * This ensures consistent lifecycle behavior across add/remove/update operations.
 */
function replaceVariableSet(
  scene: Parameters<typeof sceneGraph.getVariables>[0],
  variables: ReturnType<typeof sceneGraph.getVariables>['state']['variables']
): SceneVariableSet {
  const newVarSet = new SceneVariableSet({ variables });
  scene.setState({ $variables: newVarSet });
  newVarSet.activate();
  return newVarSet;
}

/**
 * Add a variable to the dashboard.
 */
export const handleAddVariable = createHandler<AddVariablePayload>(async (payload, context) => {
  const { scene, transaction } = context;

  try {
    const { variable: variableKind, position } = payload;
    const name = variableKind.spec.name;

    if (!name) {
      throw new Error('Variable name is required');
    }

    const existingVariables = scene.state.$variables;
    if (existingVariables) {
      const existing = existingVariables.state.variables.find((v) => v.state.name === name);
      if (existing) {
        throw new Error(`Variable '${name}' already exists`);
      }
    }

    const sceneVariable = createSceneVariableFromVariableModel(variableKind);

    const varSet = sceneGraph.getVariables(scene);
    const currentVariables = [...varSet.state.variables];

    if (position !== undefined && position >= 0 && position < currentVariables.length) {
      currentVariables.splice(position, 0, sceneVariable);
    } else {
      currentVariables.push(sceneVariable);
    }

    replaceVariableSet(scene, currentVariables);
    sceneVariable.activate();

    const changes: MutationChange[] = [
      { path: `/variables/${name}`, previousValue: undefined, newValue: { kind: variableKind.kind, name } },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      data: { name, kind: variableKind.kind },
      changes,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      changes: [],
    };
  }
});

/**
 * Remove a variable from the dashboard.
 */
export const handleRemoveVariable = createHandler<RemoveVariablePayload>(async (payload, context) => {
  const { scene, transaction } = context;
  const { name } = payload;

  try {
    const variables = scene.state.$variables;
    if (!variables) {
      throw new Error('Dashboard has no variable set');
    }

    const variable = variables.getByName(name);
    if (!variable) {
      throw new Error(`Variable '${name}' not found`);
    }

    const previousState = variable.state;

    const updatedVariables = variables.state.variables.filter((v) => v.state.name !== name);
    replaceVariableSet(scene, updatedVariables);

    const changes: MutationChange[] = [
      { path: `/variables/${name}`, previousValue: previousState, newValue: undefined },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      changes,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      changes: [],
    };
  }
});

/**
 * Update an existing variable on the dashboard.
 * Replaces the variable with a new one created from the provided VariableKind, preserving position.
 */
export const handleUpdateVariable = createHandler<UpdateVariablePayload>(async (payload, context) => {
  const { scene, transaction } = context;

  try {
    const { name, variable: variableKind } = payload;

    if (!name) {
      throw new Error('Variable name is required');
    }

    const varSet = sceneGraph.getVariables(scene);
    const currentVariables = [...varSet.state.variables];

    const existingIndex = currentVariables.findIndex((v) => v.state.name === name);
    if (existingIndex === -1) {
      throw new Error(`Variable '${name}' not found`);
    }

    const previousState = currentVariables[existingIndex].state;

    const newSceneVariable = createSceneVariableFromVariableModel(variableKind);
    currentVariables[existingIndex] = newSceneVariable;

    replaceVariableSet(scene, currentVariables);
    newSceneVariable.activate();

    const changes: MutationChange[] = [
      {
        path: `/variables/${name}`,
        previousValue: previousState,
        newValue: { kind: variableKind.kind, name: variableKind.spec.name },
      },
    ];
    transaction.changes.push(...changes);

    return {
      success: true,
      data: { name: variableKind.spec.name, kind: variableKind.kind },
      changes,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      changes: [],
    };
  }
});

/**
 * List all variables on the dashboard in v2beta1 VariableKind format.
 */
export const handleListVariables = createHandler<Record<string, never>>(async (_payload, context) => {
  const { scene } = context;

  try {
    const varSet = scene.state.$variables;
    if (!varSet || !(varSet instanceof SceneVariableSet)) {
      return {
        success: true,
        data: { variables: [] },
        changes: [],
      };
    }

    const variables = sceneVariablesSetToSchemaV2Variables(varSet, true);

    return {
      success: true,
      data: { variables },
      changes: [],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      changes: [],
    };
  }
});
