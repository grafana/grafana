import { sceneGraph } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { replaceVariableSet } from '../../mutation-api/commands/variableUtils';
import type { DashboardScene } from '../../scene/DashboardScene';
import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';
import type { UserActionCommand } from '../UserActionCommand';

/**
 * Adds a variable to the dashboard at the given position.
 *
 * Stores only declarative data (VariableKind + position): no SceneVariable
 * references are held in the command, so redo recomputes a fresh SceneVariable
 * each time and stays safe against intervening state changes.
 */
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
    const existing = varSet.state.variables.find((v) => v.state.name === name);
    if (existing) {
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
