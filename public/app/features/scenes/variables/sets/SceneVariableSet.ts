import { Unsubscribable } from 'rxjs';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneVariable, SceneVariables, SceneVariableSetState, SceneVariableValueChangedEvent } from '../types';

export class SceneVariableSet extends SceneObjectBase<SceneVariableSetState> implements SceneVariables {
  /** Variables that have changed in since the activation or since the first manual value change */
  // private variablesThatHaveChanged = new Map<string, SceneVariable>();

  /** Variables that are scheduled to be validated and updated */
  private variablesToUpdate = new Map<string, SceneVariable>();

  /** Cached variable dependencies */
  private dependencies = new Map<string, string[]>();

  /** Variables currently updating  */
  private updating = new Map<string, VariableUpdateInProgress>();

  constructor(state: SceneVariableSetState) {
    super(state);
  }

  getByName(name: string): SceneVariable | undefined {
    // TODO: Replace with index
    return this.state.variables.find((x) => x.state.name === name);
  }

  /**
   * Subscribes to child variable value changes
   * And starts the variable value validation process
   */
  activate(): void {
    super.activate();

    // Subscribe to changes to child variables
    this.subs.add(this.subscribeToEvent(SceneVariableValueChangedEvent, this.onVariableValueChanged));
    this.validateAndUpdateAll();
  }

  /**
   * Cancel all currently running updates
   */
  deactivate(): void {
    super.deactivate();
    this.variablesToUpdate.clear();

    for (const update of this.updating.values()) {
      update.subscription.unsubscribe();
    }
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
    for (const variable of this.state.variables) {
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
   * This will trigger an update of all variables that depend on it.
   * */
  onVariableValueChanged = (event: SceneVariableValueChangedEvent) => {
    const variable = event.payload;

    // Ignore this change if it is currently updating
    if (this.updating.has(variable.state.name)) {
      return;
    }

    for (const [name, deps] of this.dependencies) {
      if (deps.includes(variable.state.name)) {
        const otherVariable = this.getByName(name);
        if (otherVariable) {
          this.variablesToUpdate.set(name, otherVariable);
        }
      }
    }

    this.updateNextBatch();
  };
}

export interface VariableUpdateInProgress {
  variable: SceneVariable;
  subscription: Unsubscribable;
}
