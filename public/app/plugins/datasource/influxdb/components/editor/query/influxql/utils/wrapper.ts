import type { TypedVariableModel } from '@grafana/data/types';

export function wrapRegex(v: TypedVariableModel): string {
  return `/^$${v.name}$/`;
}

export function wrapPure(v: TypedVariableModel): string {
  return `$${v.name}`;
}
