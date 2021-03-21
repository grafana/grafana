import { CompletionItem } from '../types';
import { fuzzyMatch } from '../slate-plugins/fuzzy';

/**
 * List of auto-complete modes used by SuggestionsPlugin handleTypeahead
 * @see SuggestionsPlugin
 */

/**
 * Exact-word matching mode for auto-complete suggestions.
 * - Returns items containing the full search text.
 */
export const wordSearch = (items: CompletionItem[], text: string): CompletionItem[] => {
  return items.filter((c) => (c.filterText || c.label).includes(text));
};

/**
 * Prefix-based mode for auto-complete suggestions.
 * - Returns items starting with the search text.
 */
export const prefixSearch = (items: CompletionItem[], text: string): CompletionItem[] => {
  return items.filter((c) => (c.filterText || c.label).startsWith(text));
};

/**
 * Fuzzy search mode for auto-complete suggestions.
 * - Returns items containing all letters from the search text occurring in the same order.
 * - Stores highlight parts with parts of the text phrase found by fuzzy search
 */
export const fuzzySearch = (items: CompletionItem[], text: string): CompletionItem[] => {
  text = text.toLowerCase();
  return items.filter((item) => {
    const { distance, ranges, found } = fuzzyMatch(item.label.toLowerCase(), text);
    if (!found) {
      return false;
    }
    item.sortValue = distance;
    item.highlightParts = ranges;
    return true;
  });
};
