/**
 * ADD_VARIABLE command
 *
 * Add a template variable to the dashboard using v2beta1 VariableKind format.
 *
 * Concept (normalize helper): the `__scenesPayload` discriminated-union
 * branch lives in `normalize()` at the top of the file, not inside the
 * handler. The handler then has exactly one branch — state mutation. This
 * is the pattern other commands should follow when migrating.
 */

import { type z } from 'zod';

import { sceneGraph, type SceneVariable } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { isSceneNativeVariablePayload, replaceVariableSet } from './variableUtils';

export const addVariablePayloadSchema = payloads.addVariable;

export type AddVariablePayload = z.infer<typeof addVariablePayloadSchema>;

interface NormalizedAddVariable {
  sceneVariable: SceneVariable;
  name: string;
  position: number | undefined;
}

/**
 * Normalize either payload shape into a single object the handler can use.
 * Contains the `__scenesPayload` fork in one place; the handler stays focused
 * on state mutation only.
 */
function normalize(payload: AddVariablePayload | { __scenesPayload: SceneVariable }): NormalizedAddVariable {
  if (isSceneNativeVariablePayload(payload)) {
    return { sceneVariable: payload.__scenesPayload, name: payload.__scenesPayload.state.name, position: undefined };
  }
  const variableKind = payload.variable;
  return {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with VariableKind
    sceneVariable: createSceneVariableFromVariableModel(variableKind as VariableKind),
    name: variableKind.spec.name,
    position: payload.position,
  };
}

export const addVariableCommand: MutationCommand<AddVariablePayload> = {
  name: 'ADD_VARIABLE',
  description: payloads.addVariable.description ?? '',

  payloadSchema: payloads.addVariable,
  permission: requiresEdit,
  readOnly: false,
  undoDomain: 'variables',
  lockTarget: 'variables',

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- payload shape narrowed via discriminated union at dispatch time
      const { sceneVariable, name, position } = normalize(payload as Parameters<typeof normalize>[0]);

      const existingVariables = scene.state.$variables;
      if (existingVariables?.state.variables.find((v) => v.state.name === name)) {
        throw new Error(`Variable '${name}' already exists`);
      }

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
        data: { name },
        changes: [{ path: `/variables/${name}`, previousValue: null, newValue: name }],
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
