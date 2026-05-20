/**
 * ADD_VARIABLE command
 *
 * Add a template variable to the dashboard using v2beta1 VariableKind format.
 */

import { type z } from 'zod';

import { sceneGraph } from '@grafana/scenes';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { replaceVariableSet } from './variableUtils';

export const addVariablePayloadSchema = payloads.addVariable;

export type AddVariablePayload = z.infer<typeof addVariablePayloadSchema>;

export const addVariableCommand: MutationCommand<AddVariablePayload> = {
  name: 'ADD_VARIABLE',
  description: payloads.addVariable.description ?? '',

  payloadSchema: payloads.addVariable,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { variable: variableKind, position } = payload;
      const name = variableKind.spec.name;

      const variablesBeforeAdd = sceneGraph.getVariables(scene).state.variables.slice();

      scene.addVariable(variableKind, position);

      return {
        success: true,
        data: { variable: variableKind },
        changes: [{ path: `/variables/${name}`, previousValue: null, newValue: variableKind }],
        _description: `Add variable '${name}'`,
        _undo: () => {
          replaceVariableSet(scene, variablesBeforeAdd);
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
