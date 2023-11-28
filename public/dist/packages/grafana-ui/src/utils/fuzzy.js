import { last } from 'lodash';
/**
 * Attempts to do a partial input search, e.g. allowing to search for a text (needle)
 * in another text (stack) by skipping some letters in-between. All letters from
 * the needle must exist in the stack in the same order to find a match.
 *
 * The search is case sensitive. Convert stack and needle to lower case
 * to make it case insensitive.
 *
 * @param stack - main text to be searched
 * @param needle - partial text to find in the stack
 *
 * @internal
 */
export function fuzzyMatch(stack, needle) {
    let distance = 0, searchIndex = stack.indexOf(needle);
    // Remove whitespace from needle as a temporary solution to treat separate string
    // queries as 'AND'
    needle = needle.replace(/\s/g, '');
    const ranges = [];
    if (searchIndex !== -1) {
        return {
            distance: 0,
            found: true,
            ranges: [{ start: searchIndex, end: searchIndex + needle.length - 1 }],
        };
    }
    for (const letter of needle) {
        const letterIndex = stack.indexOf(letter, searchIndex);
        if (letterIndex === -1) {
            return { distance: Infinity, ranges: [], found: false };
        }
        // do not cumulate the distance if it's the first letter
        if (searchIndex !== -1) {
            distance += letterIndex - searchIndex;
        }
        searchIndex = letterIndex + 1;
        if (ranges.length === 0) {
            ranges.push({ start: letterIndex, end: letterIndex });
        }
        else {
            const lastRange = last(ranges);
            if (letterIndex === lastRange.end + 1) {
                lastRange.end++;
            }
            else {
                ranges.push({ start: letterIndex, end: letterIndex });
            }
        }
    }
    return {
        distance: distance,
        ranges,
        found: true,
    };
}
//# sourceMappingURL=fuzzy.js.map