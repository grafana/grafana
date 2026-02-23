import { fuzzySearch } from '@grafana/data';

import { ComboboxOption } from './types';

export function itemToString<T extends string | number>(item?: ComboboxOption<T> | null) {
  if (item == null) {
    return '';
  }
  return item.label ?? item.value.toString();
}

export function fuzzyFind<T extends string | number>(
  options: Array<ComboboxOption<T>>,
  haystack: string[],
  needle: string
) {
  const indices = fuzzySearch(haystack, needle);
  return indices.map((idx) => options[idx]);
}
