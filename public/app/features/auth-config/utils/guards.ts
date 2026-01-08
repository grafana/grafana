import { SelectableValue } from '@grafana/data';

export function isSelectableValueArray(value: unknown): value is SelectableValue[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'object' && v !== null && 'value' in v);
}

export function isSelectableValue<T>(value: unknown): value is SelectableValue<T> {
  return typeof value === 'object' && value !== null && 'value' in value;
}
