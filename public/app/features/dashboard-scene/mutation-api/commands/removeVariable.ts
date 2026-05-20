/**
 * REMOVE_VARIABLE command
 *
 * Remove a template variable from the dashboard by name.
 */

import { type z } from 'zod';

import { sceneGraph } from '@grafana/scenes';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { replaceVariableSet } from './variableUtils';

export const removeVariablePayloadSchema = payloads.removeVariable;

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
      const varSet = sceneGraph.getVariables(scene);
      const existingVar = varSet.state.variables.find((v) => v.state.name === name);
      if (!existingVar) {
        throw new Error(`Variable '${name}' not found`);
      }
      const previousState = existingVar.state;
      const variablesBeforeRemove = varSet.state.variables.slice();

      scene.removeVariable(name);

      return {
        success: true,
        data: { name },
        changes: [{ path: `/variables/${name}`, previousValue: previousState, newValue: null }],
        _description: `Remove variable '${name}'`,
        _undo: () => {
          replaceVariableSet(scene, variablesBeforeRemove);
        },
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
