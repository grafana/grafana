import { Subscription, Unsubscribable } from 'rxjs';

import { SceneVariable, SceneVariables } from '../types';

export interface VariableUpdateInProgress {
  variable: SceneVariable;
  subscription: Unsubscribable;
}

/**
 * This is really an internal implementation detail of SceneVariableList (the unit tests for the logic in this class are in SceneVariableList.test.ts)
 * Should the file content be moved to SceneVariableList?
 */
export class VariablesUpdateManager {
  variablesThatHaveChanged = new Map<string, SceneVariable>();
  variablesToUpdate = new Map<string, SceneVariable>();
  subs: Subscription = new Subscription();
  dependencies = new Map<string, string[]>();
  updating = new Map<string, VariableUpdateInProgress>();
  sceneContext: SceneVariables;

  constructor(sceneContext: SceneVariables) {
    this.sceneContext = sceneContext;
  }

  /**
   * This loops through variablesToUpdate and update all that that can.
   * If one has a dependency that is currently in variablesToUpdate it will be skipped for now.
   */
  updateNextBatch() {
    for (const [name, variable] of this.variablesToUpdate) {
      if (!variable.validateAndUpdate) {
        throw new Error('Variable added to variablesToUpdate but does not have validateAndUpdate');
      }

      // Wait for variables that has dependencies that also needs updates
      if (this.hasDependendencyInUpdateQueue(variable)) {
        continue;
      }

      this.updating.set(name, {
        variable,
        subscription: variable.validateAndUpdate().subscribe({
          next: () => this.validateAndUpdateCompleted(variable),
          error: (err) => this.handleVariableError(variable, err),
        }),
      });
    }
  }

  /**
   * A variable has completed it's update process. This could mean that variables that depend on it can now be updated in turn.
   */
  private validateAndUpdateCompleted(variable: SceneVariable) {
    const update = this.updating.get(variable.state.name);
    update?.subscription.unsubscribe();

    this.updating.delete(variable.state.name);
    this.variablesToUpdate.delete(variable.state.name);
    this.updateNextBatch();
  }

  /**
   * TODO handle this properly (and show error in UI).
   * Not sure if this should be handled here on in MultiValueVariable
   */
  private handleVariableError(variable: SceneVariable, err: Error) {
    variable.setState({ loading: false, error: err });
  }

  /**
   * Checks if the variable has any dependencies that is currently in variablesToUpdate
   */
  private hasDependendencyInUpdateQueue(variable: SceneVariable) {
    const dependencies = this.dependencies.get(variable.state.name);

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

  /**
   * Extract dependencies from all variables and add those that needs update to the variablesToUpdate map
   * Then it will start the update process.
   */
  validateAndUpdateAll() {
    for (const variable of this.sceneContext.state.variables) {
      if (variable.validateAndUpdate) {
        this.variablesToUpdate.set(variable.state.name, variable);
      }

      if (variable.getDependencies) {
        this.dependencies.set(variable.state.name, variable.getDependencies());
      }
    }

    this.updateNextBatch();
  }

  /**
   * Updates dependencies in case they changed
   * */
  variableStateChanged(variable: SceneVariable) {
    if (variable.getDependencies) {
      this.dependencies.set(variable.state.name, variable.getDependencies());
    }
  }

  /**
   * This will trigger an update of all variables that depend on it.
   * */
  variableValueChanged(variable: SceneVariable) {
    // Ignore this change if it is currently updating
    if (this.updating.has(variable.state.name)) {
      return;
    }

    for (const [name, deps] of this.dependencies) {
      if (deps.includes(variable.state.name)) {
        const otherVariable = this.sceneContext.getByName(name);
        if (otherVariable) {
          this.variablesToUpdate.set(name, otherVariable);
        }
      }
    }

    this.updateNextBatch();
  }
}
