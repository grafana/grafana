import { SceneVariable, SceneVariableDependencyConfigLike } from '@grafana/scenes';

import { DashboardGridItem } from './DashboardGridItem';

export class DashboardGridItemVariableDependencyHandler implements SceneVariableDependencyConfigLike {
  constructor(private _gridItem: DashboardGridItem) {}

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
       * We do not really care if the variable has changed or not as we do an equality check in performRepeat
       * And this function needs to be called even when variable valued id not change as performRepeat calls
       * notifyRepeatedPanelsWaitingForVariables which is needed to notify panels waiting for variable to complete (even when the value did not change)
       * This is for scenarios where the variable used for repeating is depending on time range.
       */
      this._gridItem.performRepeat();
    }
  }
}
