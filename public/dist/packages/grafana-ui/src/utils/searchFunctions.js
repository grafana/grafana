var _a;
import { fuzzyMatch } from './fuzzy';
/**
 * List of auto-complete search function used by SuggestionsPlugin.handleTypeahead()
 * @alpha
 */
export var SearchFunctionType;
(function (SearchFunctionType) {
    SearchFunctionType["Word"] = "Word";
    SearchFunctionType["Prefix"] = "Prefix";
    SearchFunctionType["Fuzzy"] = "Fuzzy";
})(SearchFunctionType || (SearchFunctionType = {}));
/**
 * Exact-word matching for auto-complete suggestions.
 * - Returns items containing the searched text.
 * @internal
 */
var wordSearch = function (items, text) {
    return items.filter(function (c) { return (c.filterText || c.label).includes(text); });
};
/**
 * Prefix-based search for auto-complete suggestions.
 * - Returns items starting with the searched text.
 * @internal
 */
var prefixSearch = function (items, text) {
    return items.filter(function (c) { return (c.filterText || c.label).startsWith(text); });
};
/**
 * Fuzzy search for auto-complete suggestions.
 * - Returns items containing all letters from the search text occurring in the same order.
 * - Stores highlight parts with parts of the text phrase found by fuzzy search
 * @internal
 */
var fuzzySearch = function (items, text) {
    text = text.toLowerCase();
    return items.filter(function (item) {
        var _a = fuzzyMatch(item.label.toLowerCase(), text), distance = _a.distance, ranges = _a.ranges, found = _a.found;
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
export var SearchFunctionMap = (_a = {},
    _a[SearchFunctionType.Word] = wordSearch,
    _a[SearchFunctionType.Prefix] = prefixSearch,
    _a[SearchFunctionType.Fuzzy] = fuzzySearch,
    _a);
//# sourceMappingURL=searchFunctions.js.map