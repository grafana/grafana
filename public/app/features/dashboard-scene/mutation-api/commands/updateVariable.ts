/**
 * UPDATE_VARIABLE command
 *
 * Replace an existing template variable with a new definition, preserving its position.
 */

import { z } from 'zod';

import { sceneGraph } from '@grafana/scenes';

import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { replaceVariableSet } from './addVariable';
import { variableKindSchema } from './shared';
import { requiresEdit, type CommandDefinition } from './types';

const payloadSchema = z.object({
  name: z.string().describe('Variable name to update'),
  variable: variableKindSchema.describe('New variable definition (VariableKind)'),
});

export type UpdateVariablePayload = z.infer<typeof payloadSchema>;

export const updateVariableCommand: CommandDefinition<UpdateVariablePayload> = {
  name: 'UPDATE_VARIABLE',
  description: 'Replace an existing template variable with a new definition, preserving its position.',

  payloadSchema,
  permission: requiresEdit,

  handler: async (payload, context) => {
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

      const changes = [
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
  },
};
