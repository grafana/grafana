import { sceneGraph } from '@grafana/scenes';
import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import type { DashboardScene } from '../../scene/DashboardScene';
import type { UserActionCommand } from '../UserActionCommand';

/**
 * Removes a variable from the dashboard.
 *
 * Undo is declarative: records the index at perform() time (a primitive),
 * then re-inserts the stored VariableKind at that index.
 * No Scene-object references are captured in closures.
 */
export class RemoveVariableCommand implements UserActionCommand {
  title: string;

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
    const variables = sceneGraph.getVariables(this.scene).state.variables;
    this.removedIndex = variables.findIndex((v) => v.state.name === this.name);
    this.scene.removeVariable(this.name);
  }

  undo(): void {
    // Declarative inverse: re-insert at the recorded index using stored data.
    this.scene.addVariable(this.variableKind, this.removedIndex);
  }
}
