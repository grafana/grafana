import { SelectableValue } from '@grafana/data';

export function isSelectableValue(value: unknown): value is SelectableValue[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'object' && v !== null && 'value' in v);
}
