/**
 * ADD_VARIABLE command
 *
 * Add a template variable to the dashboard using v2beta1 VariableKind format.
 */

import { type z } from 'zod';

import { sceneGraph } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { dashboardEditActions } from '../../edit-pane/shared';
import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { replaceVariableSet } from './variableUtils';

const addVariablePayloadSchema = payloads.addVariable;

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
      const variablesBefore = [...varSet.state.variables];
      const variablesAfter = [...variablesBefore];

      if (position !== undefined && position >= 0 && position < variablesAfter.length) {
        variablesAfter.splice(position, 0, sceneVariable);
      } else {
        variablesAfter.push(sceneVariable);
      }

      dashboardEditActions.addElement({
        addedObject: sceneVariable,
        source: varSet,
        perform: () => replaceVariableSet(scene, variablesAfter),
        undo: () => replaceVariableSet(scene, variablesBefore),
      });

      return {
        success: true,
        data: { variable: variableKind },
        changes: [{ path: `/variables/${name}`, previousValue: null, newValue: variableKind }],
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
