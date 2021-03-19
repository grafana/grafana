import { CompletionItem, CompletionMode } from '../types';
import fuzzySearch from '../slate-plugins/fuzzy';

/**
 * List of auto-complete modes used by SuggestionsPlugin handleTypeahead
 * @see SuggestionsPlugin
 */

/**
 * Exact-word matching mode for auto-complete suggestions.
 * - Returns items containing the full search text.
 * - Sorts items by sortText or label property.
 */
export const WordCompletionMode: CompletionMode = {
  filterFunction: (items: CompletionItem[], text: string): CompletionItem[] => {
    return items.filter((c) => (c.filterText || c.label).includes(text));
  },
  sortFunction: (item: CompletionItem) => item.sortText || item.label,
};

/**
 * Prefix-based mode for auto-complete suggestions.
 * - Returns items starting with the search text.
 * - Sorts items by sortText or label property.
 */
export const PrefixCompletionMode: CompletionMode = {
  filterFunction: (items: CompletionItem[], text: string): CompletionItem[] => {
    return items.filter((c) => (c.filterText || c.label).startsWith(text));
  },
  sortFunction: (item: CompletionItem) => item.sortText || item.label,
};

/**
 * Fuzzy search mode for auto-complete suggestions.
 * - Returns items containing all letters from the search text occurring in the same order.
 * - Sorts items by matching score based on number of unmatched letters between matching ones.
 */
export const FuzzyCompletionMode: CompletionMode = {
  filterFunction: (items: CompletionItem[], text: string): CompletionItem[] => {
    return fuzzySearch(items, text);
  },
  sortFunction: (item: CompletionItem) => item.matching!.score,
};
