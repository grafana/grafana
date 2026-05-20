/**
 * UPDATE_VARIABLE command
 *
 * Replace an existing template variable with a new definition, preserving its position.
 */

import { type z } from 'zod';

import { sceneGraph, type SceneVariable } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { isSceneNativeVariablePayload, replaceVariableSet } from './variableUtils';

export const updateVariablePayloadSchema = payloads.updateVariable;

export type UpdateVariablePayload = z.infer<typeof updateVariablePayloadSchema>;

export const updateVariableCommand: MutationCommand<UpdateVariablePayload> = {
  name: 'UPDATE_VARIABLE',
  description: payloads.updateVariable.description ?? '',

  payloadSchema: payloads.updateVariable,
  permission: requiresEdit,
  readOnly: false,
  undoDomain: 'variables',

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      let newSceneVariable: SceneVariable;
      let name: string;

      if (isSceneNativeVariablePayload(payload)) {
        newSceneVariable = payload.__scenesPayload;
        name = newSceneVariable.state.name;
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated by Zod in DashboardMutationClient
        const typedPayload = payload as UpdateVariablePayload;
        name = typedPayload.name;
        const variableKind = typedPayload.variable;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with VariableKind
        newSceneVariable = createSceneVariableFromVariableModel(variableKind as VariableKind);
      }

      const varSet = sceneGraph.getVariables(scene);
      const currentVariables = [...varSet.state.variables];

      const existingIndex = currentVariables.findIndex((v) => v.state.name === name);
      if (existingIndex === -1) {
        throw new Error(`Variable '${name}' not found`);
      }

      const previousState = currentVariables[existingIndex].state;
      currentVariables[existingIndex] = newSceneVariable;

      replaceVariableSet(scene, currentVariables);

      return {
        success: true,
        data: { name },
        changes: [{ path: `/variables/${name}`, previousValue: previousState, newValue: name }],
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
