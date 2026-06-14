/**
 * REMOVE_VARIABLE command
 *
 * Agent-facing REMOVE_VARIABLE handler. Goes through the layered architecture:
 *   ClientCommand (validate + look up + map) -> UserActionsService.execute -> RemoveVariableCommand
 */

import { type z } from 'zod';

import { MutationApiClient } from '../Client';

import { RemoveVariableClientCommand } from './RemoveVariableClientCommand';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

const removeVariablePayloadSchema = payloads.removeVariable;

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

    const client = new MutationApiClient(scene, scene.userActionsService);
    const result = await client.execute(new RemoveVariableClientCommand(), payload);

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
      data: { name: payload.name },
      changes: [{ path: `/variables/${payload.name}`, previousValue: 'removed', newValue: null }],
    };
  },
};
