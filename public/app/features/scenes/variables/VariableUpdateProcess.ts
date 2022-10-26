import { Subscription, Unsubscribable } from 'rxjs';

import { SceneObject } from '../core/types';

import { SceneVariable } from './types';

export interface VariableUpdateInProgress {
  variable: SceneVariable;
  subscription: Unsubscribable;
}

export class VariableUpdateProcess {
  variablesToUpdate = new Map<string, SceneVariable>();
  subs: Subscription = new Subscription();
  dependencies = new Map<string, string[]>();
  updating = new Map<string, VariableUpdateInProgress>();
  sceneContext: SceneObject;

  constructor(sceneContext: SceneObject) {
    this.sceneContext = sceneContext;
  }

  updateTick() {
    for (const [key, variable] of this.variablesToUpdate) {
      if (!variable.updateOptions) {
        continue;
      }

      // Wait for variables that has dependencies that also needs updates
      if (this.hasDependendencyThatNeedsUpdating(variable)) {
        continue;
      }

      this.updating.set(key, {
        variable,
        subscription: variable.updateOptions(this).subscribe({
          next: () => this.variableProcessed(key, variable),
          error: (err) => this.variableProcessed(key, variable, err),
        }),
      });
    }
  }

  private variableProcessed(key: string, variable: SceneVariable, err?: Error) {
    const update = this.updating.get(key);
    update?.subscription.unsubscribe();

    this.updating.delete(key);
    this.dependencies.delete(key);
    this.variablesToUpdate.delete(key);
    this.updateTick();
  }

  private hasDependendencyThatNeedsUpdating(variable: SceneVariable) {
    const dependencies = this.dependencies.get(variable.state.key!);

    if (dependencies) {
      for (const dep of dependencies) {
        for (const otherVariable of this.variablesToUpdate.values()) {
          if (otherVariable.state.name === dep) {
            return true;
          }
        }
      }
    }

    return false;
  }

  addVariable(...variables: SceneVariable[]) {
    for (const variable of variables) {
      this.variablesToUpdate.set(variable.state.key!, variable);

      if (variable.getDependencies) {
        this.dependencies.set(variable.state.key!, variable.getDependencies());
      }
    }
  }
}
