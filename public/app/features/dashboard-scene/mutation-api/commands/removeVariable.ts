/**
 * REMOVE_VARIABLE command
 *
 * Remove a template variable from the dashboard by name.
 */

import { z } from 'zod';

import { replaceVariableSet } from './addVariable';
import { payloads } from './schemas';
import { requiresEdit, type MutationCommand } from './types';

export const removeVariablePayloadSchema = payloads.removeVariable;

export type RemoveVariablePayload = z.infer<typeof removeVariablePayloadSchema>;

export const removeVariableCommand: MutationCommand<RemoveVariablePayload> = {
  name: 'REMOVE_VARIABLE',
  description: payloads.removeVariable.description ?? '',

  payloadSchema: payloads.removeVariable,
  permission: requiresEdit,

  handler: async (payload, context) => {
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

      const changes = [{ path: `/variables/${name}`, previousValue: previousState, newValue: undefined }];
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
  },
};
