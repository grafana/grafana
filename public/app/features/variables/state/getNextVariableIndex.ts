import { TypedVariableModel } from '@grafana/data';

import { defaultVariablesFilter } from './defaultVariablesFilter';

export function getNextVariableIndex(variables: TypedVariableModel[]): number {
  const sorted = variables.filter(defaultVariablesFilter).sort((v1, v2) => v1.index - v2.index);
  return sorted.length > 0 ? sorted[sorted.length - 1].index + 1 : 0;
}
