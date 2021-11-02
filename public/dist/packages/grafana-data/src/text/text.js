import { __read, __spreadArray, __values } from "tslib";
/**
 * Adapt findMatchesInText for react-highlight-words findChunks handler.
 * See https://github.com/bvaughn/react-highlight-words#props
 */
export function findHighlightChunksInText(_a) {
    var e_1, _b;
    var searchWords = _a.searchWords, textToHighlight = _a.textToHighlight;
    var chunks = [];
    try {
        for (var searchWords_1 = __values(searchWords), searchWords_1_1 = searchWords_1.next(); !searchWords_1_1.done; searchWords_1_1 = searchWords_1.next()) {
            var term = searchWords_1_1.value;
            chunks.push.apply(chunks, __spreadArray([], __read(findMatchesInText(textToHighlight, term)), false));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (searchWords_1_1 && !searchWords_1_1.done && (_b = searchWords_1.return)) _b.call(searchWords_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return chunks;
}
var cleanNeedle = function (needle) {
    return needle.replace(/[[{(][\w,.-?:*+]+$/, '');
};
/**
 * Returns a list of substring regexp matches.
 */
export function findMatchesInText(haystack, needle) {
    // Empty search can send re.exec() into infinite loop, exit early
    if (!haystack || !needle) {
        return [];
    }
    var matches = [];
    var _a = parseFlags(cleanNeedle(needle)), cleaned = _a.cleaned, flags = _a.flags;
    var regexp;
    try {
        regexp = new RegExp("(?:" + cleaned + ")", flags);
    }
    catch (error) {
        return matches;
    }
    haystack.replace(regexp, function (substring) {
        var rest = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            rest[_i - 1] = arguments[_i];
        }
        if (substring) {
            var offset = rest[rest.length - 2];
            matches.push({
                text: substring,
                start: offset,
                length: substring.length,
                end: offset + substring.length,
            });
        }
        return '';
    });
    return matches;
}
var CLEAR_FLAG = '-';
var FLAGS_REGEXP = /\(\?([ims-]+)\)/g;
/**
 * Converts any mode modifiers in the text to the Javascript equivalent flag
 */
export function parseFlags(text) {
    var flags = new Set(['g']);
    var cleaned = text.replace(FLAGS_REGEXP, function (str, group) {
        var clearAll = group.startsWith(CLEAR_FLAG);
        for (var i = 0; i < group.length; ++i) {
            var flag = group.charAt(i);
            if (clearAll || group.charAt(i - 1) === CLEAR_FLAG) {
                flags.delete(flag);
            }
            else if (flag !== CLEAR_FLAG) {
                flags.add(flag);
            }
        }
        return ''; // Remove flag from text
    });
    return {
        cleaned: cleaned,
        flags: Array.from(flags).join(''),
    };
}
//# sourceMappingURL=text.js.map