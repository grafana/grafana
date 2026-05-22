import { sceneGraph } from '@grafana/scenes';

import { RemoveVariableCommand } from '../../user-actions/commands/RemoveVariableCommand';
import {
  type ClientCommand,
  type ClientCommandContext,
  type ClientCommandResult,
  toClientResult,
} from '../ClientCommand';

import { removeVariablePayloadSchema } from './schemas';
import { createVariableKindFromSceneVariable } from './variableUtils';

/**
 * Agent-facing REMOVE_VARIABLE client command.
 *
 * Responsibilities:
 *   1. Validate the raw JSON payload against the Zod schema.
 *   2. Look up the SceneVariable by name, convert it back to a VariableKind
 *      (so the undo can recreate it without holding a Scene reference).
 *   3. Delegate execution to UserActionsService.
 *
 * Does not mutate Scene state directly.
 */
export class RemoveVariableClientCommand implements ClientCommand {
  async handler(payload: unknown, context: ClientCommandContext): Promise<ClientCommandResult> {
    const validation = removeVariablePayloadSchema.safeParse(payload);
    if (!validation.success) {
      return { success: false, error: validation.error.message };
    }

    const { name } = validation.data;
    const varSet = sceneGraph.getVariables(context.scene);
    const existing = varSet.state.variables.find((v) => v.state.name === name);
    if (!existing) {
      return { success: false, error: `Variable '${name}' not found` };
    }

    const variableKind = createVariableKindFromSceneVariable(existing, context.scene);
    const cmd = new RemoveVariableCommand(context.scene, name, variableKind);
    return toClientResult(context.userActionsService.execute(cmd));
  }
}
