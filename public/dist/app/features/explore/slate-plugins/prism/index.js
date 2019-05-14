import * as tslib_1 from "tslib";
import React from 'react';
import Prism from 'prismjs';
var TOKEN_MARK = 'prism-token';
export function setPrismTokens(language, field, values, alias) {
    if (alias === void 0) { alias = 'variable'; }
    Prism.languages[language][field] = {
        alias: alias,
        pattern: new RegExp("(?:^|\\s)(" + values.join('|') + ")(?:$|\\s)"),
    };
}
/**
 * Code-highlighting plugin based on Prism and
 * https://github.com/ianstormtaylor/slate/blob/master/examples/code-highlighting/index.js
 *
 * (Adapted to handle nested grammar definitions.)
 */
export default function PrismPlugin(_a) {
    var definition = _a.definition, language = _a.language;
    if (definition) {
        // Don't override exising modified definitions
        Prism.languages[language] = Prism.languages[language] || definition;
    }
    return {
        /**
         * Render a Slate mark with appropiate CSS class names
         *
         * @param {Object} props
         * @return {Element}
         */
        renderMark: function (props) {
            var children = props.children, mark = props.mark;
            // Only apply spans to marks identified by this plugin
            if (mark.type !== TOKEN_MARK) {
                return undefined;
            }
            var className = "token " + mark.data.get('types');
            return React.createElement("span", { className: className }, children);
        },
        /**
         * Decorate code blocks with Prism.js highlighting.
         *
         * @param {Node} node
         * @return {Array}
         */
        decorateNode: function (node) {
            var e_1, _a;
            if (node.type !== 'paragraph') {
                return [];
            }
            var texts = node.getTexts().toArray();
            var tstring = texts.map(function (t) { return t.text; }).join('\n');
            var grammar = Prism.languages[language];
            var tokens = Prism.tokenize(tstring, grammar);
            var decorations = [];
            var startText = texts.shift();
            var endText = startText;
            var startOffset = 0;
            var endOffset = 0;
            var start = 0;
            function processToken(token, acc) {
                var e_2, _a;
                // Accumulate token types down the tree
                var types = (acc || '') + " " + (token.type || '') + " " + (token.alias || '');
                // Add mark for token node
                if (typeof token === 'string' || typeof token.content === 'string') {
                    startText = endText;
                    startOffset = endOffset;
                    var content = typeof token === 'string' ? token : token.content;
                    var newlines = content.split('\n').length - 1;
                    var length_1 = content.length - newlines;
                    var end = start + length_1;
                    var available = startText.text.length - startOffset;
                    var remaining = length_1;
                    endOffset = startOffset + remaining;
                    while (available < remaining) {
                        endText = texts.shift();
                        remaining = length_1 - available;
                        available = endText.text.length;
                        endOffset = remaining;
                    }
                    // Inject marks from up the tree (acc) as well
                    if (typeof token !== 'string' || acc) {
                        var range = {
                            anchorKey: startText.key,
                            anchorOffset: startOffset,
                            focusKey: endText.key,
                            focusOffset: endOffset,
                            marks: [{ type: TOKEN_MARK, data: { types: types } }],
                        };
                        decorations.push(range);
                    }
                    start = end;
                }
                else if (token.content && token.content.length) {
                    try {
                        // Tokens can be nested
                        for (var _b = tslib_1.__values(token.content), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var subToken = _c.value;
                            processToken(subToken, types);
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            try {
                // Process top-level tokens
                for (var tokens_1 = tslib_1.__values(tokens), tokens_1_1 = tokens_1.next(); !tokens_1_1.done; tokens_1_1 = tokens_1.next()) {
                    var token = tokens_1_1.value;
                    processToken(token);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (tokens_1_1 && !tokens_1_1.done && (_a = tokens_1.return)) _a.call(tokens_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return decorations;
        },
    };
}
//# sourceMappingURL=index.js.map