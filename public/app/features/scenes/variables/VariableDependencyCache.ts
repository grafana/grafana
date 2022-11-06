import { variableRegex } from 'app/features/variables/utils';

import { SceneObject, SceneObjectState, SceneVariableDependencyConfig } from '../core/types';

export class VariableDependencyCache<TState extends SceneObjectState> implements SceneVariableDependencyConfig {
  private _state: TState | undefined;
  private _dependencies = new Set<string>();
  scanCount = 0;

  constructor(private _sceneObject: SceneObject<TState>, private _statePath: Array<keyof TState>) {}

  getNames(): Set<string> {
    const prevState = this._state;
    const newState = (this._state = this._sceneObject.state);

    if (!prevState) {
      // First time we always scan for dependencies
      this.scanStateForDependencies(this._state);
      return this._dependencies;
    }

    // Second time we only scan if state is a different and if any specific state path has changed
    if (newState !== prevState) {
      for (const path of this._statePath) {
        if (newState[path] !== prevState[path]) {
          this.scanStateForDependencies(newState);
          break;
        }
      }
    }

    return this._dependencies;
  }

  private scanStateForDependencies(state: TState) {
    this._dependencies.clear();
    this.scanCount += 1;

    for (const path of this._statePath) {
      const value = state[path];
      if (value) {
        this.extractVariablesFrom(value);
      }
    }
  }

  private extractVariablesFrom(value: unknown) {
    variableRegex.lastIndex = 0;

    const stringToCheck = typeof value !== 'string' ? safeStringifyValue(value) : value;

    const matches = stringToCheck.matchAll(variableRegex);
    if (!matches) {
      return;
    }

    for (const match of matches) {
      const [, var1, var2, , var3] = match;
      const variableName = var1 || var2 || var3;
      this._dependencies.add(variableName);
    }
  }
}

const safeStringifyValue = (value: unknown) => {
  try {
    return JSON.stringify(value, null);
  } catch (error) {
    console.error(error);
  }

  return '';
};
