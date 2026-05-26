/**
 * REMOVE_VARIABLE command
 *
 * Remove a template variable from the dashboard by name.
 *
 * Concept (transformPayloadToScene): both callers (agent payload and
 * `__scenesPayload`) collapse into a single `{ name }` shape that the
 * client hands to the handler. The handler stays focused on state
 * mutation — no branching on payload shape.
 */

import { type z } from 'zod';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type CommandInput, type MutationCommand } from './types';
import { isSceneNativeVariablePayload, replaceVariableSet } from './variableUtils';

export const removeVariablePayloadSchema = payloads.removeVariable;

export type RemoveVariablePayload = z.infer<typeof removeVariablePayloadSchema>;

interface NormalizedRemoveVariable {
  name: string;
}

export const removeVariableCommand: MutationCommand<RemoveVariablePayload, NormalizedRemoveVariable> = {
  name: 'REMOVE_VARIABLE',
  description: payloads.removeVariable.description ?? '',

  payloadSchema: payloads.removeVariable,
  permission: requiresEdit,
  readOnly: false,
  undoDomain: 'variables',
  lockTarget: 'variables',

  transformPayloadToScene(payload: CommandInput<RemoveVariablePayload>): NormalizedRemoveVariable {
    if (isSceneNativeVariablePayload(payload)) {
      return { name: payload.__scenesPayload.state.name };
    }
    return { name: payload.name };
  },

  handler: async ({ name }, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

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

      return {
        success: true,
        data: { name },
        changes: [{ path: `/variables/${name}`, previousValue: previousState, newValue: null }],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
