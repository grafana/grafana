import xss from 'xss';
/**
 * Adapt findMatchesInText for react-highlight-words findChunks handler.
 * See https://github.com/bvaughn/react-highlight-words#props
 */
export function findHighlightChunksInText(_a) {
    var searchWords = _a.searchWords, textToHighlight = _a.textToHighlight;
    return findMatchesInText(textToHighlight, searchWords.join(' '));
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
    var cleaned = cleanNeedle(needle);
    var regexp;
    try {
        regexp = new RegExp("(?:" + cleaned + ")", 'g');
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
var XSSWL = Object.keys(xss.whiteList).reduce(function (acc, element) {
    acc[element] = xss.whiteList[element].concat(['class', 'style']);
    return acc;
}, {});
var sanitizeXSS = new xss.FilterXSS({
    whiteList: XSSWL,
});
/**
 * Returns string safe from XSS attacks.
 *
 * Even though we allow the style-attribute, there's still default filtering applied to it
 * Info: https://github.com/leizongmin/js-xss#customize-css-filter
 * Whitelist: https://github.com/leizongmin/js-css-filter/blob/master/lib/default.js
 */
export function sanitize(unsanitizedString) {
    try {
        return sanitizeXSS.process(unsanitizedString);
    }
    catch (error) {
        console.log('String could not be sanitized', unsanitizedString);
        return unsanitizedString;
    }
}
export function hasAnsiCodes(input) {
    return /\u001b\[\d{1,2}m/.test(input);
}
//# sourceMappingURL=text.js.map