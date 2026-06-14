import { AddVariableCommand } from '../../user-actions/commands/AddVariableCommand';
import {
  type ClientCommand,
  type ClientCommandContext,
  type ClientCommandResult,
  toClientResult,
} from '../ClientCommand';

import { addVariablePayloadSchema } from './schemas';

/**
 * Agent-facing ADD_VARIABLE client command.
 *
 * Responsibilities:
 *   1. Validate the raw JSON payload against the Zod schema.
 *   2. Map the validated JSON (VariableKind) to AddVariableCommand inputs.
 *   3. Delegate execution to UserActionsService.
 *
 * Does not mutate Scene state directly.
 */
export class AddVariableClientCommand implements ClientCommand {
  async handler(payload: unknown, context: ClientCommandContext): Promise<ClientCommandResult> {
    const validation = addVariablePayloadSchema.safeParse(payload);
    if (!validation.success) {
      return { success: false, error: validation.error.message };
    }

    const { variable, position } = validation.data;
    const cmd = new AddVariableCommand(context.scene, variable, position);
    return toClientResult(context.userActionsService.execute(cmd));
  }
}
