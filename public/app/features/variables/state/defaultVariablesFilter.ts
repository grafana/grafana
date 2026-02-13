import { TypedVariableModel } from '@grafana/data';

export function defaultVariablesFilter(variable: TypedVariableModel): boolean {
  return variable.type !== 'system';
}
