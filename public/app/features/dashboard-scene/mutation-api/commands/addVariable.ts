/**
 * ADD_VARIABLE command
 *
 * Add a template variable to the dashboard using v2beta1 VariableKind format.
 */

import { z } from 'zod';

import { sceneGraph } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';

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

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { variable: variableKind, position } = payload;
      const name = variableKind.spec.name;

      const existingVariables = scene.state.$variables;
      if (existingVariables) {
        const existing = existingVariables.state.variables.find((v) => v.state.name === name);
        if (existing) {
          throw new Error(`Variable '${name}' already exists`);
        }
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with VariableKind
      const sceneVariable = createSceneVariableFromVariableModel(variableKind as VariableKind);

      const varSet = sceneGraph.getVariables(scene);
      const currentVariables = [...varSet.state.variables];

      if (position !== undefined && position >= 0 && position < currentVariables.length) {
        currentVariables.splice(position, 0, sceneVariable);
      } else {
        currentVariables.push(sceneVariable);
      }

      replaceVariableSet(scene, currentVariables);

      return {
        success: true,
        data: { name, kind: variableKind.kind },
        changes: [
          { path: `/variables/${name}`, previousValue: undefined, newValue: { kind: variableKind.kind, name } },
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
