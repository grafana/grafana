/**
 * UPDATE_VARIABLE command
 *
 * Replace an existing template variable with a new definition, preserving its position.
 */

import { type z } from 'zod';

import { sceneGraph } from '@grafana/scenes';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { replaceVariableSet } from './variableUtils';

export const updateVariablePayloadSchema = payloads.updateVariable;

export type UpdateVariablePayload = z.infer<typeof updateVariablePayloadSchema>;

export const updateVariableCommand: MutationCommand<UpdateVariablePayload> = {
  name: 'UPDATE_VARIABLE',
  description: payloads.updateVariable.description ?? '',

  payloadSchema: payloads.updateVariable,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { name, variable: variableKind } = payload;
      const varSet = sceneGraph.getVariables(scene);
      const existingVar = varSet.state.variables.find((v) => v.state.name === name);
      if (!existingVar) {
        throw new Error(`Variable '${name}' not found`);
      }
      const previousState = existingVar.state;
      const variablesBeforeUpdate = varSet.state.variables.slice();

      scene.updateVariable(name, variableKind);

      return {
        success: true,
        data: { variable: variableKind },
        changes: [{ path: `/variables/${name}`, previousValue: previousState, newValue: variableKind }],
        _description: `Update variable '${name}'`,
        _undo: () => {
          replaceVariableSet(scene, variablesBeforeUpdate);
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
