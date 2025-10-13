import { CompletionItem, SearchFunction } from '../types';

import { fuzzyMatch } from './fuzzy';

/**
 * List of auto-complete search function used by SuggestionsPlugin.handleTypeahead()
 * @alpha
 */
export enum SearchFunctionType {
  Word = 'Word',
  Prefix = 'Prefix',
  Fuzzy = 'Fuzzy',
}

/**
 * Exact-word matching for auto-complete suggestions.
 * - Returns items containing the searched text.
 * @internal
 */
const wordSearch: SearchFunction = (items: CompletionItem[], text: string): CompletionItem[] => {
  return items.filter((c) => (c.filterText || c.label).includes(text));
};

/**
 * Prefix-based search for auto-complete suggestions.
 * - Returns items starting with the searched text.
 * @internal
 */
const prefixSearch: SearchFunction = (items: CompletionItem[], text: string): CompletionItem[] => {
  return items.filter((c) => (c.filterText || c.label).startsWith(text));
};

/**
 * Fuzzy search for auto-complete suggestions.
 * - Returns items containing all letters from the search text occurring in the same order.
 * - Stores highlight parts with parts of the text phrase found by fuzzy search
 * @internal
 */
const fuzzySearch: SearchFunction = (items: CompletionItem[], text: string): CompletionItem[] => {
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

/**
 * @internal
 */
export const SearchFunctionMap = {
  [SearchFunctionType.Word]: wordSearch,
  [SearchFunctionType.Prefix]: prefixSearch,
  [SearchFunctionType.Fuzzy]: fuzzySearch,
};
