import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObjectStateChangedEvent } from '../core/events';

import { VariableUpdateProcess } from './VariableUpdateProcess';
import { SceneVariable, SceneVariableSetInterface, SceneVariableSetState, SceneVariableState } from './types';

export class SceneVariableList extends SceneObjectBase<SceneVariableSetState> implements SceneVariableSetInterface {
  updateProcess?: VariableUpdateProcess;

  constructor(state: SceneVariableSetState) {
    super(state);
  }

  activate(): void {
    super.activate();

    this.updateProcess = new VariableUpdateProcess(this.parent!);

    // Subscribe to changes to child variables
    this.subs.add(this.events.subscribe(SceneObjectStateChangedEvent, this.onVariableStateChanged));
    this.updateProcess.updateAll();
  }

  onVariableStateChanged = (event: SceneObjectStateChangedEvent) => {
    const newState = event.payload.newState as SceneVariableState;
    const oldState = event.payload.prevState as SceneVariableState;
    const variable = event.payload.changedObject as SceneVariable;

    if (newState.value !== oldState.value) {
      this.updateProcess!.variableValueChanged(variable);
    }
  };

  getByName(name: string): SceneVariable | undefined {
    // TODO: Replace with index
    return this.state.variables.find((x) => x.state.name === name);
  }
}
