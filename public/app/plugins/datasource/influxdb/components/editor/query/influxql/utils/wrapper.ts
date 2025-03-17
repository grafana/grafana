import { TypedVariableModel } from '@grafana/data/src';

export function wrapRegex(v: TypedVariableModel): string {
  return `/^$${v.name}$/`;
}

export function wrapPure(v: TypedVariableModel): string {
  return `$${v.name}`;
}
