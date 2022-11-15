import { variableRegex } from 'app/features/variables/utils';

import { SceneObject, SceneObjectState } from '../core/types';

import { SceneVariable, SceneVariableDependencyConfigLike } from './types';

interface VariableDependencyConfigOptions<TState extends SceneObjectState> {
  /**
   * State paths to scan / extract variable dependencies from. Leave empty to scan all paths.
   */
  statePaths?: Array<keyof TState>;
  /**
   * Optional way to customize how to handle when a dependent variable changes
   * If not specified the default behavior is to trigger a re-render
   */
  onReferencedVariableValueChanged?: () => void;
}

export class VariableDependencyConfig<TState extends SceneObjectState> implements SceneVariableDependencyConfigLike {
  private _state: TState | undefined;
  private _dependencies = new Set<string>();
  private _statePaths?: Array<keyof TState>;
  private _onReferencedVariableValueChanged: () => void;

  public scanCount = 0;

  public constructor(private _sceneObject: SceneObject<TState>, options: VariableDependencyConfigOptions<TState>) {
    this._statePaths = options.statePaths;
    this._onReferencedVariableValueChanged =
      options.onReferencedVariableValueChanged ?? this.defaultHandlerReferencedVariableValueChanged;
  }

  /**
   * Used to check for dependency on a specific variable
   */
  public hasDependencyOn(name: string): boolean {
    return this.getNames().has(name);
  }

  /**
   * This is called whenever any set of variables have new values. It up to this implementation to check if it's relevant given the current dependencies.
   */
  public variableValuesChanged(variables: Set<SceneVariable>) {
    const deps = this.getNames();

    for (const variable of variables) {
      if (deps.has(variable.state.name)) {
        this._onReferencedVariableValueChanged();
        return;
      }
    }
  }

  /**
   * Only way to force a re-render is to update state right now
   */
  private defaultHandlerReferencedVariableValueChanged = () => {
    this._sceneObject.forceRender();
  };

  public getNames(): Set<string> {
    const prevState = this._state;
    const newState = (this._state = this._sceneObject.state);

    if (!prevState) {
      // First time we always scan for dependencies
      this.scanStateForDependencies(this._state);
      return this._dependencies;
    }

    // Second time we only scan if state is a different and if any specific state path has changed
    if (newState !== prevState) {
      if (this._statePaths) {
        for (const path of this._statePaths) {
          if (newState[path] !== prevState[path]) {
            this.scanStateForDependencies(newState);
            break;
          }
        }
      } else {
        this.scanStateForDependencies(newState);
      }
    }

    return this._dependencies;
  }

  private scanStateForDependencies(state: TState) {
    this._dependencies.clear();
    this.scanCount += 1;

    if (this._statePaths) {
      for (const path of this._statePaths) {
        const value = state[path];
        if (value) {
          this.extractVariablesFrom(value);
        }
      }
    } else {
      this.extractVariablesFrom(state);
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
