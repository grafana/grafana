/**
 * REMOVE_VARIABLE command
 *
 * Remove a template variable from the dashboard by name.
 */

import { type z } from 'zod';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';
import { isSceneNativeVariablePayload, replaceVariableSet } from './variableUtils';

export const removeVariablePayloadSchema = payloads.removeVariable;

export type RemoveVariablePayload = z.infer<typeof removeVariablePayloadSchema>;

export const removeVariableCommand: MutationCommand<RemoveVariablePayload> = {
  name: 'REMOVE_VARIABLE',
  description: payloads.removeVariable.description ?? '',

  payloadSchema: payloads.removeVariable,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    let name: string;
    if (isSceneNativeVariablePayload(payload)) {
      name = payload.__scenesPayload.state.name;
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validated by Zod in DashboardMutationClient
      name = (payload as RemoveVariablePayload).name;
    }

    try {
      const variables = scene.state.$variables;
      if (!variables) {
        throw new Error('Dashboard has no variable set');
      }

      const variable = variables.getByName(name);
      if (!variable) {
        throw new Error(`Variable '${name}' not found`);
      }

      const previousState = variable.state;
      const updatedVariables = variables.state.variables.filter((v) => v.state.name !== name);
      replaceVariableSet(scene, updatedVariables);

      return {
        success: true,
        data: { name },
        changes: [{ path: `/variables/${name}`, previousValue: previousState, newValue: null }],
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
