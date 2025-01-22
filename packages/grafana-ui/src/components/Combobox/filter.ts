import uFuzzy from '@leeoniya/ufuzzy';

import { ComboboxOption } from './Combobox';
import { ALL_OPTION_VALUE } from './MultiCombobox';

export function itemToString<T extends string | number>(item?: ComboboxOption<T> | null) {
  if (!item) {
    return '';
  }
  if (item.label?.includes('Custom value: ')) {
    return item.value.toString();
  }
  return item.label ?? item.value.toString();
}

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

const uf = new uFuzzy();

export function fuzzyFind<T extends string | number>(haystack: Array<ComboboxOption<T>>, needle: string) {
  if (needle.length === 0) {
    return haystack;
  }

  const stringifiedOptions = haystack.map((item) => itemToString(item));

  const [indices] = uf.search(stringifiedOptions, needle);

  if (!indices) {
    return [];
  }
  return indices.map((idx) => haystack[idx]);
}
