/**
 * REMOVE_VARIABLE -- the full story for this mutation in one file.
 *
 * Constructor takes a SceneVariable directly (Scene-pure). Stores the
 * removed index during perform() so undo can re-insert at the same place.
 *
 * Agent path: toUserAction does the name -> SceneVariable lookup, alongside
 * Zod validation, before constructing the command. The class itself never
 * sees a name string -- it has the object.
 */

import { type z } from 'zod';

import { sceneGraph, type SceneVariable } from '@grafana/scenes';

import type { DashboardScene } from '../../scene/DashboardScene';
import { type ClientCommand } from '../ClientCommand';
import type { UserActionCommand } from '../UserActionCommand';

import { removeVariablePayloadSchema } from './schemas';
import { replaceVariableSet } from './variableUtils';

export type RemoveVariablePayload = z.infer<typeof removeVariablePayloadSchema>;

export class RemoveVariableCommand implements UserActionCommand {
  title: string;
  lockTarget = 'variables';

  private scene: DashboardScene;
  private variable: SceneVariable;
  private removedIndex?: number;

  constructor(scene: DashboardScene, variable: SceneVariable) {
    this.scene = scene;
    this.variable = variable;
    this.title = `Remove variable '${variable.state.name}'`;
  }

  perform(): void {
    const name = this.variable.state.name;
    const varSet = sceneGraph.getVariables(this.scene);
    const index = varSet.state.variables.findIndex((v) => v.state.name === name);
    if (index < 0) {
      throw new Error(`Variable '${name}' not found`);
    }
    this.removedIndex = index;
    replaceVariableSet(
      this.scene,
      varSet.state.variables.filter((v) => v.state.name !== name)
    );
  }

  undo(): void {
    if (this.removedIndex === undefined) {
      // perform() was never called, nothing to undo.
      return;
    }
    const varSet = sceneGraph.getVariables(this.scene);
    // Clone so re-insertion produces a fresh instance, safe across SceneVariableSet swaps.
    const fresh = this.variable.clone({});
    const current = [...varSet.state.variables];
    if (this.removedIndex >= 0 && this.removedIndex < current.length) {
      current.splice(this.removedIndex, 0, fresh);
    } else {
      current.push(fresh);
    }
    replaceVariableSet(this.scene, current);
  }
}

export const removeVariableClientCommand: ClientCommand<RemoveVariablePayload> = {
  type: 'REMOVE_VARIABLE',
  description: removeVariablePayloadSchema.description ?? '',
  kind: 'write',
  schema: removeVariablePayloadSchema,
  toUserAction(payload, ctx) {
    // Lookup lives here, alongside validation. The class never sees a name string.
    const varSet = sceneGraph.getVariables(ctx.scene);
    const variable = varSet.state.variables.find((v) => v.state.name === payload.name);
    if (!variable) {
      throw new Error(`Variable '${payload.name}' not found`);
    }
    return new RemoveVariableCommand(ctx.scene, variable);
  },
};
