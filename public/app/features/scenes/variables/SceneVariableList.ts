import { SceneObjectBase } from '../core/SceneObjectBase';

import { VariableUpdateProcess } from './VariableUpdateProcess';
import { SceneVariable, SceneVariableSetInterface, SceneVariableSetState } from './types';

export class SceneVariableList extends SceneObjectBase<SceneVariableSetState> implements SceneVariableSetInterface {
  updateProcess?: VariableUpdateProcess;

  activate(): void {
    super.activate();

    this.updateProcess = new VariableUpdateProcess(this);

    for (const variable of this.state.variables) {
      if (variable.updateOptions) {
        this.updateProcess.addVariable(variable);
      }
    }

    this.updateProcess.updateTick();
  }

  getByName(name: string): SceneVariable | undefined {
    // TODO: Replace with index
    return this.state.variables.find((x) => x.state.name === name);
  }
}
