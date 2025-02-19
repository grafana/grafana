import uFuzzy from '@leeoniya/ufuzzy';

import { ALL_OPTION_VALUE, ComboboxOption } from './types';

// https://catonmat.net/my-favorite-regex :)
const REGEXP_NON_ASCII = /[^ -~]/m;
// https://www.asciitable.com/
// matches only these: `~!@#$%^&*()_+-=[]\{}|;':",./<>?
const REGEXP_ONLY_SYMBOLS = /^[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]+$/m;
// limit max terms in needle that qualify for re-ordering
const outOfOrderLimit = 5;
// beyond 25 chars fall back to substring search
const maxNeedleLength = 25;
// beyond 5 terms fall back to substring match
const maxFuzzyTerms = 5;
// when number of matches <= 1e4, do ranking + sorting by quality
const rankThreshold = 1e4;

// typo tolerance mode
const uf = new uFuzzy({ intraMode: 1 });

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
  let matches: Array<ComboboxOption<T>> = [];

  if (needle === '') {
    matches = options;
  }
  // fallback to substring matches to avoid badness
  else if (
    // contains non-ascii
    REGEXP_NON_ASCII.test(needle) ||
    // is only ascii symbols (operators)
    REGEXP_ONLY_SYMBOLS.test(needle) ||
    // too long (often copy-paste from somewhere)
    needle.length > maxNeedleLength ||
    uf.split(needle).length > maxFuzzyTerms
  ) {
    for (let i = 0; i < haystack.length; i++) {
      let item = haystack[i];

      if (item.includes(needle)) {
        matches.push(options[i]);
      }
    }
  }
  // fuzzy search
  else {
    const [idxs, info, order] = uf.search(haystack, needle, outOfOrderLimit, rankThreshold);

    if (idxs?.length) {
      if (info && order) {
        matches = order.map((idx) => options[info.idx[idx]]);
      } else {
        matches = idxs.map((idx) => options[idx]);
      }
    }
  }

  return matches;
}
