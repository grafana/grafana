/**
 * Variable mutation handlers
 */

import type { MutationResult, MutationChange, AddVariablePayload, RemoveVariablePayload } from '../types';

import type { MutationContext } from './types';

/**
 * Add a variable (stub - not fully implemented)
 */
export async function handleAddVariable(
  _payload: AddVariablePayload,
  _context: MutationContext
): Promise<MutationResult> {
  // TODO: Variable creation requires access to internal serialization functions
  // (createSceneVariableFromVariableModel) which are not currently exported.
  // This needs to be addressed by exporting the function or creating a public API.
  return {
    success: true,
    changes: [],
    warnings: ['Add variable is not fully implemented in POC - requires exported variable factory'],
  };
}

/**
 * Remove a variable from the dashboard
 */
export async function handleRemoveVariable(
  payload: RemoveVariablePayload,
  context: MutationContext
): Promise<MutationResult> {
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

    // Remove variable
    variables.setState({
      variables: variables.state.variables.filter((v: { state: { name: string } }) => v.state.name !== name),
    });

    const changes: MutationChange[] = [
      { path: `/variables/${name}`, previousValue: previousState, newValue: undefined },
    ];
    transaction.changes.push(...changes);

    // inverse mutation would need to reconstruct the VariableKind from SceneVariable state
    // This is simplified for POC
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
}
