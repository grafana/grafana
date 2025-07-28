import uFuzzy from '@leeoniya/ufuzzy';

// if the search term is longer than MAX_NEEDLE_SIZE we disable Levenshtein distance
const MAX_NEEDLE_SIZE = 25;
const INFO_THRESHOLD = Infinity;
const MAX_FUZZY_TERMS = 5;
// Out-of-order limits for permutation control
// These constants control uFuzzy's outOfOrder parameter which limits the number of term permutations
// to search for when matching multi-term queries. This is crucial for performance optimization.
const OUT_OF_ORDER_LIMIT_HIGH = 4;
const OUT_OF_ORDER_LIMIT_LOW = 0;
const OUT_OF_ORDER_THRESHOLD = 5;
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
 * Internal function that performs the core fuzzy search logic.
 * Returns the indices of matching items in the haystack.
 */
function performFuzzySearch(haystack: string[], searchTerm: string): number[] {
  const ufuzzy = createFuzzyMatcher();
  const needleTermsCount = ufuzzy.split(searchTerm).length;

  /**
   * The outOfOrder parameter controls term permutation limits in uFuzzy's search algorithm.
   *
   * Why this is needed:
   * - When searching for multi-term queries like "alert rule cpu", uFuzzy can match terms
   *   in any order against the haystack (e.g., "cpu alert rule" would also match)
   * - Without limits, the number of permutations grows factorially (n! permutations for n terms)
   * - For example: 5 terms = 120 permutations, 6 terms = 720 permutations, etc.
   * - This can cause severe performance degradation and browser freezing
   *
   * Parameter behavior:
   * - outOfOrder = 0: Only exact term order matching (fastest, most restrictive)
   * - outOfOrder > 0: Allows up to N terms to be out of their original order
   * - Higher values = more permutations = slower but more flexible matching
   *
   * Our strategy:
   * - For queries with fewer terms (< 5): Allow more flexibility (outOfOrder = 4)
   * - For queries with many terms (≥ 5): Restrict to exact order only (outOfOrder = 0)
   * - This balances search flexibility with performance, preventing browser hangs
   *
   * Reference: https://github.com/leeoniya/uFuzzy#api
   */
  const outOfOrderLimit = needleTermsCount < OUT_OF_ORDER_THRESHOLD ? OUT_OF_ORDER_LIMIT_HIGH : OUT_OF_ORDER_LIMIT_LOW;

  const [idxs, info, order] = ufuzzy.search(haystack, searchTerm, outOfOrderLimit, INFO_THRESHOLD);

  if (info && order) {
    return order.map((idx) => info.idx[idx]);
  } else if (idxs) {
    return [...idxs];
  }

  return [];
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

  const haystack = items.map(filterBy);
  const matchingIndices = performFuzzySearch(haystack, searchTerm);

  return matchingIndices.map((idx) => items[idx]);
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

  const haystack = [target];
  const matchingIndices = performFuzzySearch(haystack, searchTerm);

  return matchingIndices.length > 0;
}
