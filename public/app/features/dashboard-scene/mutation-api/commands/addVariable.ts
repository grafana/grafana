/**
 * ADD_VARIABLE -- the full story for this mutation in one file.
 *
 * Two exports:
 *   - AddVariableCommand: the UserActionCommand class. Carries the mutation
 *     logic (perform / undo) and is the shared primitive used by both the UI
 *     (constructs directly) and the agent (constructed via toUserAction).
 *   - addVariableClientCommand: the agent-facing data record. Declares the
 *     Zod schema and how to turn a validated payload into the class.
 */

import { type z } from 'zod';

import { sceneGraph } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import type { DashboardScene } from '../../scene/DashboardScene';
import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { type WriteClientCommand } from '../ClientCommand';
import type { UserActionCommand } from '../UserActionCommand';

import { addVariablePayloadSchema } from './schemas';
import { replaceVariableSet } from './variableUtils';

export type AddVariablePayload = z.infer<typeof addVariablePayloadSchema>;

export class AddVariableCommand implements UserActionCommand {
  title: string;
  lockTarget = 'variables';

  private scene: DashboardScene;
  private variableKind: VariableKind;
  private position: number | undefined;

  constructor(scene: DashboardScene, variableKind: VariableKind, position?: number) {
    this.scene = scene;
    this.variableKind = variableKind;
    this.position = position;
    this.title = `Add variable '${variableKind.spec.name}'`;
  }

  perform(): void {
    const name = this.variableKind.spec.name;
    const varSet = sceneGraph.getVariables(this.scene);
    if (varSet.state.variables.find((v) => v.state.name === name)) {
      throw new Error(`Variable '${name}' already exists`);
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structurally compatible
    const sceneVariable = createSceneVariableFromVariableModel(this.variableKind as VariableKind);
    const current = [...varSet.state.variables];
    if (this.position !== undefined && this.position >= 0 && this.position < current.length) {
      current.splice(this.position, 0, sceneVariable);
    } else {
      current.push(sceneVariable);
    }
    replaceVariableSet(this.scene, current);
  }

  undo(): void {
    // Declarative inverse: remove by name. No Scene reference held.
    const name = this.variableKind.spec.name;
    const varSet = sceneGraph.getVariables(this.scene);
    replaceVariableSet(
      this.scene,
      varSet.state.variables.filter((v) => v.state.name !== name)
    );
  }
}

export const addVariableClientCommand: WriteClientCommand<AddVariablePayload> = {
  type: 'ADD_VARIABLE',
  description: addVariablePayloadSchema.description ?? '',
  schema: addVariablePayloadSchema,
  kind: 'write',
  toUserAction(payload, ctx) {
    return new AddVariableCommand(ctx.scene, payload.variable, payload.position);
  },
};
