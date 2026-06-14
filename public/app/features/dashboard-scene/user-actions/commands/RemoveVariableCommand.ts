import { sceneGraph } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { replaceVariableSet } from '../../mutation-api/commands/variableUtils';
import type { DashboardScene } from '../../scene/DashboardScene';
import { createSceneVariableFromVariableModel } from '../../serialization/transformSaveModelSchemaV2ToScene';
import type { UserActionCommand } from '../UserActionCommand';

/**
 * Removes a variable from the dashboard.
 *
 * Undo is declarative: records the removed index at perform() time (a number),
 * then re-creates a SceneVariable from the stored VariableKind and inserts it
 * at that index. No SceneVariable references are captured in closures.
 */
export class RemoveVariableCommand implements UserActionCommand {
  title: string;
  lockTarget = 'variables';

  private scene: DashboardScene;
  private name: string;
  private variableKind: VariableKind;
  private removedIndex = 0;

  constructor(scene: DashboardScene, name: string, variableKind: VariableKind) {
    this.scene = scene;
    this.name = name;
    this.variableKind = variableKind;
    this.title = `Remove variable '${name}'`;
  }

  perform(): void {
    const varSet = sceneGraph.getVariables(this.scene);
    this.removedIndex = varSet.state.variables.findIndex((v) => v.state.name === this.name);
    if (this.removedIndex < 0) {
      throw new Error(`Variable '${this.name}' not found`);
    }
    replaceVariableSet(
      this.scene,
      varSet.state.variables.filter((v) => v.state.name !== this.name)
    );
  }

  undo(): void {
    const varSet = sceneGraph.getVariables(this.scene);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structurally compatible
    const sceneVariable = createSceneVariableFromVariableModel(this.variableKind as VariableKind);
    const current = [...varSet.state.variables];
    if (this.removedIndex >= 0 && this.removedIndex < current.length) {
      current.splice(this.removedIndex, 0, sceneVariable);
    } else {
      current.push(sceneVariable);
    }
    replaceVariableSet(this.scene, current);
  }
}
