/**
 * ADD_VARIABLE command
 *
 * Agent-facing ADD_VARIABLE handler. Goes through the layered architecture:
 *   ClientCommand (validate + map) -> UserActionsService.execute -> AddVariableCommand
 */

import { type z } from 'zod';

import { MutationApiClient } from '../Client';

import { AddVariableClientCommand } from './AddVariableClientCommand';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

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

    const client = new MutationApiClient(scene, scene.userActionsService);
    const result = await client.execute(new AddVariableClientCommand(), payload);

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? 'Unknown error',
        changes: [],
        ...(result.locked ? { locked: true } : {}),
      };
    }

    return {
      success: true,
      data: { variable: payload.variable },
      changes: [{ path: `/variables/${payload.variable.spec.name}`, previousValue: null, newValue: payload.variable }],
    };
  },
};
