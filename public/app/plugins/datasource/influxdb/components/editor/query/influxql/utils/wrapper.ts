import { TypedVariableModel } from '@grafana/data';

export function wrapRegex(v: TypedVariableModel): string {
  return `/^$${v.name}$/`;
}

export function wrapPure(v: TypedVariableModel): string {
  return `$${v.name}`;
}
