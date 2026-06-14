/**
 * REMOVE_VARIABLE command
 *
 * Remove a template variable from the dashboard by name.
 */

import { type z } from 'zod';

import { dashboardEditActions } from '../../edit-pane/shared';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { replaceVariableSet } from './variableUtils';

const removeVariablePayloadSchema = payloads.removeVariable;

export type RemoveVariablePayload = z.infer<typeof removeVariablePayloadSchema>;

export const removeVariableCommand: MutationCommand<RemoveVariablePayload> = {
  name: 'REMOVE_VARIABLE',
  description: payloads.removeVariable.description ?? '',

  payloadSchema: payloads.removeVariable,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    const { name } = payload;
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

      const variablesBefore = [...variables.state.variables];
      const variablesAfter = variablesBefore.filter((v) => v.state.name !== name);

      dashboardEditActions.removeElement({
        removedObject: variable,
        source: variables,
        perform: () => replaceVariableSet(scene, variablesAfter),
        undo: () => replaceVariableSet(scene, variablesBefore),
      });

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
