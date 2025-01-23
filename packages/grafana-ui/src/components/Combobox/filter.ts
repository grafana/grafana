import uFuzzy from '@leeoniya/ufuzzy';

import { ComboboxOption } from './Combobox';

// https://catonmat.net/my-favorite-regex :)
const REGEXP_NON_ASCII = /[^ -~]/m;

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

export function fuzzyFind<T extends string | number>(
  options: Array<ComboboxOption<T>>,
  haystack: string[],
  needle: string
) {
  if (needle === '') {
    return options;
  }

  // Non-ascii support
  if (REGEXP_NON_ASCII.test(needle)) {
    const nonAsciiMatches = [];
    for (let i = 0; i < haystack.length; i++) {
      const item = haystack[i];
      if (item.includes(needle)) {
        nonAsciiMatches.push(options[i]);
      }
    }

    return nonAsciiMatches;
  }

  const [indices] = uf.search(haystack, needle);

  if (!indices) {
    return [];
  }
  return indices.map((index) => options[index]);
}
