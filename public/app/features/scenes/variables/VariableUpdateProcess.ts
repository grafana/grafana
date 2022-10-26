import { Subscription } from 'rxjs';

import { SceneObject } from '../core/types';

import { SceneVariable } from './types';

export class VariableUpdateProcess {
  variablesToUpdate = new Map<string, SceneVariable>();
  subs: Subscription = new Subscription();
  dependencies = new Map<string, string[]>();
  updating = new Map<string, SceneVariable>();
  sceneContext: SceneObject;

  constructor(sceneContext: SceneObject) {
    this.sceneContext = sceneContext;
  }

  tick() {
    for (const [key, variable] of this.variablesToUpdate) {
      if (!variable.updateOptions) {
        continue;
      }

      // Wait for variables that has dependencies that also needs updates
      if (this.hasDependendencyThatNeedsUpdating(variable)) {
        continue;
      }

      this.updating.set(key, variable);
      this.subs.add(
        variable.updateOptions(this).subscribe({
          next: () => {
            console.log('completed', key);
            this.variableProcessed(key, variable);
          },
          error: (err) => this.variableProcessed(key, variable, err),
        })
      );
    }
  }

  private variableProcessed(key: string, variable: SceneVariable, err?: Error) {
    this.updating.delete(key);
    this.dependencies.delete(key);
    this.variablesToUpdate.delete(key);
    console.log('deleting', err);
    this.tick();
  }

  private hasDependendencyThatNeedsUpdating(variable: SceneVariable) {
    const dependencies = this.dependencies.get(variable.state.key!);

    if (dependencies) {
      for (const dep of dependencies) {
        for (const otherVariable of this.variablesToUpdate.values()) {
          if (otherVariable.state.name === dep) {
            console.log('has depdency waiting for update', dep);
            return true;
          }
        }
      }
    }

    return false;
  }

  addVariable(variable: SceneVariable) {
    this.variablesToUpdate.set(variable.state.key!, variable);

    if (variable.getDependencies) {
      this.dependencies.set(variable.state.key!, variable.getDependencies());
    }
  }
}
