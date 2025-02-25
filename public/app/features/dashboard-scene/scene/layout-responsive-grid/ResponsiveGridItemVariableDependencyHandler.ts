import { SceneVariable, SceneVariableDependencyConfigLike } from '@grafana/scenes';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export class ResponsiveGridItemVariableDependencyHandler implements SceneVariableDependencyConfigLike {
  constructor(private _gridItem: ResponsiveGridItem) {}

  public getNames(): Set<string> {
    if (this._gridItem.state.variableName) {
      return new Set([this._gridItem.state.variableName]);
    }

    return new Set();
  }

  public hasDependencyOn(name: string): boolean {
    return this._gridItem.state.variableName === name;
  }

  public variableUpdateCompleted(variable: SceneVariable) {
    if (this._gridItem.state.variableName === variable.state.name) {
      /**
       * We need to call performRepeat even when the variable value hasn't changed
       * as it handles notifying panels waiting for variable completion.
       * This is particularly important for scenarios where the repeating variable
       * depends on time range changes.
       */
      this._gridItem.performRepeat();
    }
  }
}
