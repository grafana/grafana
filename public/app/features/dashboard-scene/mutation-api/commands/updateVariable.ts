/**
 * UPDATE_VARIABLE command
 *
 * Replace an existing template variable with a new definition, preserving its position.
 */

import type { InferOutput } from 'valibot';

import { sceneGraph } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { getPayloadDescription, payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { replaceVariableSet } from './variableUtils';

export const updateVariablePayloadSchema = payloads.updateVariable;

export type UpdateVariablePayload = InferOutput<typeof updateVariablePayloadSchema>;

export const updateVariableCommand: MutationCommand<UpdateVariablePayload> = {
  name: 'UPDATE_VARIABLE',
  description: getPayloadDescription(payloads.updateVariable),

  payloadSchema: payloads.updateVariable,
  permission: requiresEdit,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { name, variable: variableKind } = payload;

      const varSet = sceneGraph.getVariables(scene);
      const currentVariables = [...varSet.state.variables];

      const existingIndex = currentVariables.findIndex((v) => v.state.name === name);
      if (existingIndex === -1) {
        throw new Error(`Variable '${name}' not found`);
      }

      const previousState = currentVariables[existingIndex].state;

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with VariableKind
      const newSceneVariable = createSceneVariableFromVariableModel(variableKind as VariableKind);
      currentVariables[existingIndex] = newSceneVariable;

      replaceVariableSet(scene, currentVariables);

      return {
        success: true,
        data: { name: variableKind.spec.name, kind: variableKind.kind },
        changes: [
          {
            path: `/variables/${name}`,
            previousValue: previousState,
            newValue: { kind: variableKind.kind, name: variableKind.spec.name },
          },
        ],
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
