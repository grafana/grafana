import { SceneObjectBase } from '../core/SceneObjectBase';

import { SceneVariable, SceneVariableSet, SceneVariableSetState, SceneVariableState } from './types';

export class TextBoxSceneVariable extends SceneObjectBase<SceneVariableState> implements SceneVariable {}

export class SceneVariableManager extends SceneObjectBase<SceneVariableSetState> implements SceneVariableSet {
  activate(): void {
    super.activate();
    this.state.variables.forEach((x) => x.activate());
  }

  getVariableByName(name: string): SceneVariable | undefined {
    // TODO: Replace with index
    return this.state.variables.find((x) => x.state.name === name);
  }
}
