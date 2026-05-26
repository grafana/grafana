import { type z } from 'zod';

import { AddVariableCommand } from '../../user-actions/commands/AddVariableCommand';
import { type WriteClientCommand } from '../ClientCommand';

import { addVariablePayloadSchema } from './schemas';

export type AddVariablePayload = z.infer<typeof addVariablePayloadSchema>;

/**
 * Agent-facing ADD_VARIABLE command. Data record, not a class.
 *
 * MutationApiClient.execute() validates the payload against `schema` and
 * dispatches `toUserAction(payload, ctx)` through dashboardEditActions, so
 * the agent and the UI share the same mutation primitive (AddVariableCommand).
 */
export const addVariableClientCommand: WriteClientCommand<AddVariablePayload> = {
  type: 'ADD_VARIABLE',
  description: addVariablePayloadSchema.description ?? '',
  schema: addVariablePayloadSchema,
  kind: 'write',
  toUserAction(payload, ctx) {
    return new AddVariableCommand(ctx.scene, payload.variable, payload.position);
  },
};
