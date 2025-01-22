import uFuzzy from '@leeoniya/ufuzzy';

import { ComboboxOption } from './Combobox';

export function itemToString<T extends string | number>(item?: ComboboxOption<T> | null) {
  if (!item) {
    return '';
  }
  if (item.label?.includes('Custom value: ')) {
    return item.value.toString();
  }
  return item.label ?? item.value.toString();
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
