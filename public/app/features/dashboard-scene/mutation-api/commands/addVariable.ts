/**
 * ADD_VARIABLE command
 *
 * Add a template variable to the dashboard using v2beta1 VariableKind format.
 */

import { type z } from 'zod';

import { AddVariableCommand } from '../../user-actions/commands/AddVariableCommand';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

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

    const { variable, position } = payload;

    const result = scene.userActionsService.execute(new AddVariableCommand(scene, variable, position));

    if (!result.success) {
      return { success: false, error: result.error ?? 'Unknown error', changes: [] };
    }

    return {
      success: true,
      data: { variable },
      changes: [{ path: `/variables/${variable.spec.name}`, previousValue: null, newValue: variable }],
    };
  },
};
