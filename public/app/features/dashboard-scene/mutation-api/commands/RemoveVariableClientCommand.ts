import { type z } from 'zod';

import { sceneGraph } from '@grafana/scenes';

import { RemoveVariableCommand } from '../../user-actions/commands/RemoveVariableCommand';
import { type WriteClientCommand } from '../ClientCommand';

import { removeVariablePayloadSchema } from './schemas';
import { createVariableKindFromSceneVariable } from './variableUtils';

export type RemoveVariablePayload = z.infer<typeof removeVariablePayloadSchema>;

/**
 * Agent-facing REMOVE_VARIABLE command. Data record, not a class.
 *
 * `toUserAction` looks up the SceneVariable by name and snapshots it as a
 * VariableKind so the resulting RemoveVariableCommand can undo without
 * holding a Scene reference.
 */
export const removeVariableClientCommand: WriteClientCommand<RemoveVariablePayload> = {
  type: 'REMOVE_VARIABLE',
  description: removeVariablePayloadSchema.description ?? '',
  schema: removeVariablePayloadSchema,
  kind: 'write',
  toUserAction(payload, ctx) {
    const varSet = sceneGraph.getVariables(ctx.scene);
    const existing = varSet.state.variables.find((v) => v.state.name === payload.name);
    if (!existing) {
      throw new Error(`Variable '${payload.name}' not found`);
    }
    const variableKind = createVariableKindFromSceneVariable(existing, ctx.scene);
    return new RemoveVariableCommand(ctx.scene, payload.name, variableKind);
  },
};
