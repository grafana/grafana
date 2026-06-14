/**
 * UPDATE_VARIABLE command
 *
 * Replace an existing template variable with a new definition, preserving its position.
 */

import { type z } from 'zod';

import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { dashboardEditActions } from '../../edit-pane/shared';
import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { replaceVariableSet } from './variableUtils';

const updateVariablePayloadSchema = payloads.updateVariable;

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
      const variablesBefore = [...varSet.state.variables];

      const existingIndex = variablesBefore.findIndex((v) => v.state.name === name);
      if (existingIndex === -1) {
        throw new Error(`Variable '${name}' not found`);
      }

      const oldVariable = variablesBefore[existingIndex];
      const previousState = oldVariable.state;

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with VariableKind
      const newSceneVariable = createSceneVariableFromVariableModel(variableKind as VariableKind);
      const variablesAfter = [...variablesBefore];
      variablesAfter[existingIndex] = newSceneVariable;

      dashboardEditActions.edit({
        description: t('dashboard.mutation-api.update-variable', 'Update variable'),
        source: varSet,
        addedObject: newSceneVariable,
        removedObject: oldVariable,
        perform: () => replaceVariableSet(scene, variablesAfter),
        undo: () => replaceVariableSet(scene, variablesBefore),
      });

      return {
        success: true,
        data: { variable: variableKind },
        changes: [
          {
            path: `/variables/${name}`,
            previousValue: previousState,
            newValue: variableKind,
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
