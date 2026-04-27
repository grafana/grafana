import type { SelectableValue } from '@grafana/data/types';

export function toSelectableValue<T extends string>(t: T): SelectableValue<T> {
  return { label: t, value: t };
}
