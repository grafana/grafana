import type { TypedVariableModel } from '@grafana/data/types';

export function defaultVariablesFilter(variable: TypedVariableModel): boolean {
  return variable.type !== 'system';
}
