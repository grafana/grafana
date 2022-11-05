import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneObjectStateChangedEvent } from '../../core/events';
import { SceneVariable, SceneVariables, SceneVariableSetState, SceneVariableState } from '../types';

import { VariablesUpdateManager } from './VariableUpdateManager';

export class SceneVariableSet extends SceneObjectBase<SceneVariableSetState> implements SceneVariables {
  updateManager?: VariablesUpdateManager;

  constructor(state: SceneVariableSetState) {
    super(state);
  }

  activate(): void {
    super.activate();

    this.updateManager = new VariablesUpdateManager(this);

    // Subscribe to changes to child variables
    this.subs.add(this.subscribeToEvent(SceneObjectStateChangedEvent, this.onVariableStateChanged));
    this.updateManager.validateAndUpdateAll();
  }

  onVariableStateChanged = (event: SceneObjectStateChangedEvent) => {
    const newState = event.payload.newState as SceneVariableState;
    const oldState = event.payload.prevState as SceneVariableState;
    const variable = event.payload.changedObject as SceneVariable;

    if (newState.value !== oldState.value) {
      this.updateManager!.variableValueChanged(variable);
    }
  };

  getByName(name: string): SceneVariable | undefined {
    // TODO: Replace with index
    return this.state.variables.find((x) => x.state.name === name);
  }
}
