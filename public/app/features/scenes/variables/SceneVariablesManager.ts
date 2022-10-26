import { SceneObjectBase } from '../core/SceneObjectBase';

import { VariableUpdateProcess } from './VariableUpdateProcess';
import { SceneVariable, SceneVariableSet, SceneVariableSetState, SceneVariableState } from './types';

export class TextBoxSceneVariable extends SceneObjectBase<SceneVariableState> implements SceneVariable {}

export class SceneVariablesManager extends SceneObjectBase<SceneVariableSetState> implements SceneVariableSet {
  activate(): void {
    super.activate();

    const updateProcess = new VariableUpdateProcess(this);

    for (const variable of this.state.variables) {
      if (variable.updateOptions) {
        updateProcess.addVariable(variable);
      }
    }

    updateProcess.updateTick();
  }

  getVariableByName(name: string): SceneVariable | undefined {
    // TODO: Replace with index
    return this.state.variables.find((x) => x.state.name === name);
  }
}
