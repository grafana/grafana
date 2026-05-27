/**
 * ADD_VARIABLE -- the full story for this mutation in one file.
 *
 * Two exports:
 *   - AddVariableCommand: the UserActionCommand class. Takes a SceneVariable
 *     and operates on Scene objects only. The shared mutation primitive used
 *     by both the UI (constructed directly) and the agent (constructed via
 *     toUserAction after translation).
 *   - addVariableClientCommand: the agent-facing data record. The agent layer
 *     owns translation: Zod validates the VariableKind payload, then turns it
 *     into a SceneVariable before constructing the command. The class itself
 *     never sees a VariableKind.
 */

import { type z } from 'zod';

import { sceneGraph, type SceneVariable } from '@grafana/scenes';

import type { DashboardScene } from '../../scene/DashboardScene';
import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { type ClientCommand } from '../ClientCommand';
import type { UserActionCommand } from '../UserActionCommand';

import { addVariablePayloadSchema } from './schemas';
import { replaceVariableSet } from './variableUtils';

export type AddVariablePayload = z.infer<typeof addVariablePayloadSchema>;

export class AddVariableCommand implements UserActionCommand {
  title: string;
  lockTarget = 'variables';

  private scene: DashboardScene;
  private variable: SceneVariable;
  private position: number | undefined;

  constructor(scene: DashboardScene, variable: SceneVariable, position?: number) {
    this.scene = scene;
    this.variable = variable;
    this.position = position;
    this.title = `Add variable '${variable.state.name}'`;
  }

  perform(): void {
    const name = this.variable.state.name;
    const varSet = sceneGraph.getVariables(this.scene);
    if (varSet.state.variables.find((v) => v.state.name === name)) {
      throw new Error(`Variable '${name}' already exists`);
    }
    // Clone so each perform produces a fresh instance, safe across the
    // SceneVariableSet swaps that replaceVariableSet performs.
    const fresh = this.variable.clone({});
    const current = [...varSet.state.variables];
    if (this.position !== undefined && this.position >= 0 && this.position < current.length) {
      current.splice(this.position, 0, fresh);
    } else {
      current.push(fresh);
    }
    replaceVariableSet(this.scene, current);
  }

  undo(): void {
    const name = this.variable.state.name;
    const varSet = sceneGraph.getVariables(this.scene);
    replaceVariableSet(
      this.scene,
      varSet.state.variables.filter((v) => v.state.name !== name)
    );
  }
}

export const addVariableClientCommand: ClientCommand<AddVariablePayload> = {
  type: 'ADD_VARIABLE',
  description: addVariablePayloadSchema.description ?? '',
  kind: 'write',
  schema: addVariablePayloadSchema,
  toUserAction(payload, ctx) {
    // Translation lives here, alongside validation. The class never sees VariableKind.
    const sceneVariable = createSceneVariableFromVariableModel(payload.variable);
    return new AddVariableCommand(ctx.scene, sceneVariable, payload.position);
  },
};
