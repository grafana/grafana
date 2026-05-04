/**
 * ADD_VARIABLE command
 *
 * Add a template variable to the dashboard using v2beta1 VariableKind format.
 */

import { type z } from 'zod';

import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { buildVariableChangePath, resolveVariableScope } from './variableScope';
import { getOwnerVariableArray, replaceOwnerVariableSet } from './variableUtils';

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
      const { variable: variableKind, position, parentPath } = payload;
      const name = variableKind.spec.name;

      const { owner, layoutPathPrefix } = resolveVariableScope(scene, parentPath);

      const existingVariables = owner.state.$variables;
      if (existingVariables) {
        const existing = existingVariables.state.variables.find((v) => v.state.name === name);
        if (existing) {
          throw new Error(`Variable '${name}' already exists`);
        }
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with VariableKind
      const sceneVariable = createSceneVariableFromVariableModel(variableKind as VariableKind);

      const currentVariables = [...getOwnerVariableArray(owner)];

      if (position !== undefined && position >= 0 && position < currentVariables.length) {
        currentVariables.splice(position, 0, sceneVariable);
      } else {
        currentVariables.push(sceneVariable);
      }

      replaceOwnerVariableSet(owner, currentVariables);

      const changePath = buildVariableChangePath(layoutPathPrefix, name);

      return {
        success: true,
        data: { variable: variableKind },
        changes: [{ path: changePath, previousValue: null, newValue: variableKind }],
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
