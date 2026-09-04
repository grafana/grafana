import { fuzzySearch } from '@grafana/data';

import { type ComboboxOption } from './types';

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

/**
 * Returns the index of the option whose displayed text is exactly the search term, or -1 if there is none.
 * A case sensitive match wins over a case insensitive one.
 */
export function findExactMatchIndex<T extends string | number>(options: Array<ComboboxOption<T>>, needle: string) {
  if (needle === '') {
    return -1;
  }

  const lowerCaseNeedle = needle.toLowerCase();
  let caseInsensitiveMatchIndex = -1;

  for (let index = 0; index < options.length; index++) {
    const optionText = itemToString(options[index]);

    // Comparing the lengths first keeps the common case cheap - lists of options can be very long
    if (optionText.length !== needle.length) {
      continue;
    }

    if (optionText === needle) {
      return index;
    }

    if (caseInsensitiveMatchIndex === -1 && optionText.toLowerCase() === lowerCaseNeedle) {
      caseInsensitiveMatchIndex = index;
    }
  }

  return caseInsensitiveMatchIndex;
}

/**
 * Moves the option that exactly matches the search term to the front of the list. Without this, an option that
 * merely contains the search term can sort first and become the option that pressing enter selects.
 */
export function hoistExactMatch<T extends string | number>(options: Array<ComboboxOption<T>>, needle: string) {
  const exactMatchIndex = findExactMatchIndex(options, needle);

  if (exactMatchIndex <= 0) {
    return options;
  }

  // Make sure to clone the array first to avoid mutating the original array!
  const reordered = options.slice();
  const [exactMatch] = reordered.splice(exactMatchIndex, 1);
  reordered.unshift(exactMatch);

  return reordered;
}
