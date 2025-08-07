import { fuzzySearch } from '@grafana/data';

/**
 * Applies fuzzy search to a list of items using the provided filter function.
 * Uses @grafana/data fuzzySearch implementation with all built-in optimizations.
 */
export function fuzzyFilter<TItem>(items: TItem[], filterBy: (item: TItem) => string, searchTerm: string): TItem[] {
  if (!searchTerm.trim()) {
    return items;
  }

  const haystack = items.map(filterBy);
  const matchingIndices = fuzzySearch(haystack, searchTerm);
  return matchingIndices.map((idx) => items[idx]);
}

/**
 * Checks if a search term matches a target string using fuzzy matching.
 * Returns true if there's a match, false otherwise.
 */
export function fuzzyMatches(target: string, searchTerm: string): boolean {
  if (!searchTerm.trim()) {
    return true;
  }

  const haystack = [target];
  const matchingIndices = fuzzySearch(haystack, searchTerm);
  return matchingIndices.length > 0;
}
