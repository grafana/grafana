import uFuzzy from '@leeoniya/ufuzzy';

// if the search term is longer than MAX_NEEDLE_SIZE we disable Levenshtein distance
const MAX_NEEDLE_SIZE = 25;
const INFO_THRESHOLD = Infinity;
const MAX_FUZZY_TERMS = 5;
// https://catonmat.net/my-favorite-regex :)
const REGEXP_NON_ASCII = /[^ -~]/m;
// https://www.asciitable.com/
// matches only these: `~!@#$%^&*()_+-=[]\\{}|;':\",./<>?
const REGEXP_ONLY_SYMBOLS = /^[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]+$/m;

/**
 * Creates a uFuzzy instance with optimized settings for rule search.
 * Uses Damerau-Levenshtein distance configuration.
 */
export function createFuzzyMatcher(): uFuzzy {
  // Options details can be found here https://github.com/leeoniya/uFuzzy#options
  // The following configuration complies with Damerau-Levenshtein distance
  // https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
  return new uFuzzy({ intraMode: 1 });
}

/**
 * Determines if fuzzy search should be used based on the search term characteristics.
 * Falls back to simple string search for edge cases.
 */
export function shouldUseFuzzySearch(searchTerm: string): boolean {
  const ufuzzy = createFuzzyMatcher();
  const needleTermsCount = ufuzzy.split(searchTerm).length;

  // If the search term is very long or contains non-ascii characters or only special characters we don't use fuzzy search
  // and need to fallback to simple string search
  const fuzzySearchNotApplicable =
    REGEXP_NON_ASCII.test(searchTerm) ||
    REGEXP_ONLY_SYMBOLS.test(searchTerm) ||
    searchTerm.length > MAX_NEEDLE_SIZE ||
    needleTermsCount > MAX_FUZZY_TERMS;

  return !fuzzySearchNotApplicable;
}

/**
 * Applies fuzzy search to a list of items using the provided filter function.
 * Falls back to simple string matching when fuzzy search is not applicable.
 */
export function fuzzyFilter<TItem>(items: TItem[], filterBy: (item: TItem) => string, searchTerm: string): TItem[] {
  if (!searchTerm.trim()) {
    return items;
  }

  // Check if we should use fuzzy search
  if (!shouldUseFuzzySearch(searchTerm)) {
    return items.filter((item) => filterBy(item).toLowerCase().includes(searchTerm.toLowerCase()));
  }

  const ufuzzy = createFuzzyMatcher();
  const needleTermsCount = ufuzzy.split(searchTerm).length;
  const haystack = items.map(filterBy);

  // apply an outOfOrder limit which helps to limit the number of permutations to search for
  // and prevents the browser from hanging
  const outOfOrderLimit = needleTermsCount < 5 ? 4 : 0;

  const [idxs, info, order] = ufuzzy.search(haystack, searchTerm, outOfOrderLimit, INFO_THRESHOLD);

  let filteredItems = items;
  if (info && order) {
    filteredItems = order.map((idx) => items[info.idx[idx]]);
  } else if (idxs) {
    filteredItems = idxs.map((idx) => items[idx]);
  }

  return filteredItems;
}

/**
 * Simple fallback filter for cases where fuzzy search is not applicable.
 * Performs case-insensitive substring matching.
 */
export function getFallbackFilter<TItem>(
  items: TItem[],
  filterBy: (item: TItem) => string,
  searchTerm: string
): TItem[] {
  if (!searchTerm.trim()) {
    return items;
  }

  return items.filter((item) => filterBy(item).toLowerCase().includes(searchTerm.toLowerCase()));
}

/**
 * Checks if a search term matches a target string using fuzzy matching.
 * Returns true if there's a match, false otherwise.
 */
export function fuzzyMatches(target: string, searchTerm: string): boolean {
  if (!searchTerm.trim()) {
    return true;
  }

  // Check if we should use fuzzy search
  if (!shouldUseFuzzySearch(searchTerm)) {
    return target.toLowerCase().includes(searchTerm.toLowerCase());
  }

  const ufuzzy = createFuzzyMatcher();
  const needleTermsCount = ufuzzy.split(searchTerm).length;
  const haystack = [target];

  // apply an outOfOrder limit which helps to limit the number of permutations to search for
  // and prevents the browser from hanging
  const outOfOrderLimit = needleTermsCount < 5 ? 4 : 0;

  const [idxs] = ufuzzy.search(haystack, searchTerm, outOfOrderLimit, INFO_THRESHOLD);

  return Boolean(idxs && idxs.length > 0);
}
