import { fuzzySearch } from '@grafana/data';

import { type ComboboxOption } from './types';

export function itemToString<T extends string | number>(item?: ComboboxOption<T> | null) {
  if (item == null) {
    return '';
  }
  return item.label ?? item.value.toString();
}

/**
 * Returns the string to fuzzy search against for an option - the label concatenated
 * with the description (when present) so users can filter by either.
 */
export function itemToSearchableString<T extends string | number>(item: ComboboxOption<T>) {
  const label = itemToString(item);
  return item.description ? `${label}|${item.description}` : label;
}

export function fuzzyFind<T extends string | number>(
  options: Array<ComboboxOption<T>>,
  haystack: string[],
  needle: string
) {
  const indices = fuzzySearch(haystack, needle);
  return indices.map((idx) => options[idx]);
}
