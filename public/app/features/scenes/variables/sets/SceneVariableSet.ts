import { Unsubscribable } from 'rxjs';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneObject } from '../../core/types';
import { forEachSceneObjectInState } from '../../core/utils';
import { SceneVariable, SceneVariables, SceneVariableSetState, SceneVariableValueChangedEvent } from '../types';

export class SceneVariableSet extends SceneObjectBase<SceneVariableSetState> implements SceneVariables {
  /** Variables that have changed in since the activation or since the first manual value change */
  private variablesThatHaveChanged = new Set<string>();

  /** Variables that are scheduled to be validated and updated */
  private variablesToUpdate = new Map<string, SceneVariable>();

  /** Variables currently updating  */
  private updating = new Map<string, VariableUpdateInProgress>();

  public getByName(name: string): SceneVariable | undefined {
    // TODO: Replace with index
    return this.state.variables.find((x) => x.state.name === name);
  }

  /**
   * Subscribes to child variable value changes
   * And starts the variable value validation process
   */
  public activate(): void {
    super.activate();

    // Subscribe to changes to child variables
    this._subs.add(this.subscribeToEvent(SceneVariableValueChangedEvent, this.onVariableValueChanged));
    this.validateAndUpdateAll();
  }

  /**
   * Cancel all currently running updates
   */
  public deactivate(): void {
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
    // If we have nothing more to update and variable values changed we need to update scene objects that depend on these variables
    if (this.variablesToUpdate.size === 0 && this.variablesThatHaveChanged.size > 0) {
      this.updateDependentSceneObjects();
      return;
    }

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
    if (!variable.getVariableDependencies) {
      return false;
    }

    for (const dep of variable.getVariableDependencies()) {
      for (const otherVariable of this.variablesToUpdate.values()) {
        if (otherVariable.state.name === dep) {
          return true;
        }
      }

    return false;
  }

  /**
   * Extract dependencies from all variables and add those that needs update to the variablesToUpdate map
   * Then it will start the update process.
   */
  private validateAndUpdateAll() {
    for (const variable of this.state.variables) {
      if (variable.validateAndUpdate) {
        this.variablesToUpdate.set(variable.state.name, variable);
      }
    }

    this.updateNextBatch();
  }

  /**
   * This will trigger an update of all variables that depend on it.
   * */
  private onVariableValueChanged = (event: SceneVariableValueChangedEvent) => {
    const variableThatChanged = event.payload;

    this.variablesThatHaveChanged.add(variableThatChanged.state.name);

    // Ignore this change if it is currently updating
    if (this.updating.has(variableThatChanged.state.name)) {
      return;
    }

    for (const otherVariable of this.state.variables) {
      if (otherVariable.getVariableDependencies) {
        if (otherVariable.getVariableDependencies().has(variableThatChanged.state.name)) {
          this.variablesToUpdate.set(otherVariable.state.name, otherVariable);
        }
      }
    }

    this.updateNextBatch();
  };

  /**
   * Walk scene object graph and update all objects that depend on variables that have changed
   */
  updateDependentSceneObjects() {
    if (!this.parent) {
      return;
    }

    updateSceneGraph(this.parent, this.variablesThatHaveChanged);
    this.variablesThatHaveChanged.clear();
  }
}

function updateSceneGraph(sceneObject: SceneObject, variablesThatChanged: Set<string>) {
  if (sceneObject.getVariableDependencies) {
    for (const dep of sceneObject.getVariableDependencies()) {
      if (variablesThatChanged.has(dep)) {
        sceneObject.setState({});
        break;
      }
    }
  }

  forEachSceneObjectInState(sceneObject.state, (child) => updateSceneGraph(child, variablesThatChanged));
}

export interface VariableUpdateInProgress {
  variable: SceneVariable;
  subscription: Unsubscribable;
}
