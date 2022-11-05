import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneVariable, SceneVariables, SceneVariableSetState, SceneVariableValueChangedEvent } from '../types';

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
    this.subs.add(
      this.subscribeToEvent(SceneVariableValueChangedEvent, (event) =>
        this.updateManager!.variableValueChanged(event.payload)
      )
    );

    this.updateManager.validateAndUpdateAll();
  }

  getByName(name: string): SceneVariable | undefined {
    // TODO: Replace with index
    return this.state.variables.find((x) => x.state.name === name);
  }
}
