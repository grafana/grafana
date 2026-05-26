/**
 * REMOVE_VARIABLE -- the full story for this mutation in one file.
 *
 * Constructor takes just `(scene, name)`. The class does the SceneVariable
 * lookup and VariableKind serialization itself inside perform(), so both
 * the UI and the agent use the same one-arg construction signature -- no
 * pre-computation at the call site.
 */

import { type z } from 'zod';

import { sceneGraph } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import type { DashboardScene } from '../../scene/DashboardScene';
import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { type WriteClientCommand } from '../ClientCommand';
import type { UserActionCommand } from '../UserActionCommand';

import { removeVariablePayloadSchema } from './schemas';
import { createVariableKindFromSceneVariable, replaceVariableSet } from './variableUtils';

export type RemoveVariablePayload = z.infer<typeof removeVariablePayloadSchema>;

export class RemoveVariableCommand implements UserActionCommand {
  title: string;
  lockTarget = 'variables';

  private scene: DashboardScene;
  private name: string;
  // Snapshotted during perform() so undo can recreate the variable without
  // holding a SceneVariable reference. Declarative: only primitives stored.
  private snapshot?: { variableKind: VariableKind; index: number };

  constructor(scene: DashboardScene, name: string) {
    this.scene = scene;
    this.name = name;
    this.title = `Remove variable '${name}'`;
  }

  perform(): void {
    const varSet = sceneGraph.getVariables(this.scene);
    const index = varSet.state.variables.findIndex((v) => v.state.name === this.name);
    if (index < 0) {
      throw new Error(`Variable '${this.name}' not found`);
    }
    const variable = varSet.state.variables[index];
    this.snapshot = {
      variableKind: createVariableKindFromSceneVariable(variable, this.scene),
      index,
    };
    replaceVariableSet(
      this.scene,
      varSet.state.variables.filter((v) => v.state.name !== this.name)
    );
  }

  undo(): void {
    if (!this.snapshot) {
      // perform() was never called, nothing to undo.
      return;
    }
    const varSet = sceneGraph.getVariables(this.scene);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structurally compatible
    const sceneVariable = createSceneVariableFromVariableModel(this.snapshot.variableKind as VariableKind);
    const current = [...varSet.state.variables];
    if (this.snapshot.index >= 0 && this.snapshot.index < current.length) {
      current.splice(this.snapshot.index, 0, sceneVariable);
    } else {
      current.push(sceneVariable);
    }
    replaceVariableSet(this.scene, current);
  }
}

export const removeVariableClientCommand: WriteClientCommand<RemoveVariablePayload> = {
  type: 'REMOVE_VARIABLE',
  description: removeVariablePayloadSchema.description ?? '',
  schema: removeVariablePayloadSchema,
  kind: 'write',
  toUserAction(payload, ctx) {
    return new RemoveVariableCommand(ctx.scene, payload.name);
  },
};
