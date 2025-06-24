import { fuzzySearch } from '@grafana/data';

import { ALL_OPTION_VALUE, ComboboxOption } from './types';

export function itemToString<T extends string | number>(item?: ComboboxOption<T> | null) {
  if (item == null) {
    return '';
  }
  return item.label ?? item.value.toString();
}

//TODO: Remove when MutliCombobox async has been merged
export function itemFilter<T extends string | number>(inputValue: string) {
  const lowerCasedInputValue = inputValue.toLowerCase();

  return (item: ComboboxOption<T>) => {
    return (
      !inputValue ||
      item.label?.toLowerCase().includes(lowerCasedInputValue) ||
      item.value?.toString().toLowerCase().includes(lowerCasedInputValue) ||
      item.value.toString() === ALL_OPTION_VALUE
    );
  };
}

export function fuzzyFind<T extends string | number>(
  options: Array<ComboboxOption<T>>,
  haystack: string[],
  needle: string
) {
  const indices = fuzzySearch(haystack, needle);
  return indices.map((idx) => options[idx]);
}
