import type { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import type { DashboardScene } from '../../scene/DashboardScene';
import type { UserActionCommand } from '../UserActionCommand';

/**
 * Adds a variable to the dashboard at the given position.
 *
 * Undo is declarative: uses the stored variable name to remove it.
 * No Scene-object references are captured in closures.
 */
export class AddVariableCommand implements UserActionCommand {
  title: string;

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
    this.scene.addVariable(this.variableKind, this.position);
  }

  undo(): void {
    // Declarative inverse: remove by name. No Scene reference held.
    this.scene.removeVariable(this.variableKind.spec.name);
  }
}
