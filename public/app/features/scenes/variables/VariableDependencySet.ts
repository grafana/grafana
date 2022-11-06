import { variableRegex } from 'app/features/variables/utils';

export class VariableDependencySet<TState> {
  private state: TState | undefined;
  private dependencies = new Set<string>();
  scanCount = 0;

  constructor(private statePath: Array<keyof TState>) {}

  /**
   * Scans the state for dependencies and returns them. It will only check the statePaths.
   * And it will only re-scan if state has changed and the specific statePaths have new value
   */
  getVariableDependencies(newState: TState): Set<string> {
    const prevState = this.state;
    this.state = newState;

    if (!prevState) {
      // First time we always scan for dependencies
      this.scanStateForDependencies(this.state);
      return this.dependencies;
    }

    // Second time we only scan if state is a different and if any specific state path has changed
    if (newState !== prevState) {
      for (const path of this.statePath) {
        if (newState[path] !== prevState[path]) {
          this.scanStateForDependencies(newState);
          break;
        }
      }
    }

    return this.dependencies;
  }

  private scanStateForDependencies(state: TState) {
    this.dependencies.clear();
    this.scanCount += 1;

    for (const path of this.statePath) {
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
      this.dependencies.add(variableName);
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
