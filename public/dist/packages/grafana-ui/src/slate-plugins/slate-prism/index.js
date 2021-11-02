import { __read, __spreadArray } from "tslib";
import Prism from 'prismjs';
import { Block } from 'slate';
import Options from './options';
import TOKEN_MARK from './TOKEN_MARK';
/**
 * A Slate plugin to highlight code syntax.
 */
export function SlatePrism(optsParam, prismLanguages) {
    if (optsParam === void 0) { optsParam = {}; }
    if (prismLanguages === void 0) { prismLanguages = Prism.languages; }
    var opts = new Options(optsParam);
    return {
        decorateNode: function (node, editor, next) {
            if (!opts.onlyIn(node)) {
                return next();
            }
            var block = Block.create(node);
            var grammarName = opts.getSyntax(block);
            var grammar = prismLanguages[grammarName];
            if (!grammar) {
                // Grammar not loaded
                return [];
            }
            // Tokenize the whole block text
            var texts = block.getTexts();
            var blockText = texts.map(function (text) { return text && text.getText(); }).join('\n');
            var tokens = Prism.tokenize(blockText, grammar);
            var flattened = flattenTokens(tokens);
            var newData = editor.value.data.set('tokens', flattened);
            editor.setData(newData);
            return decorateNode(opts, tokens, block);
        },
        renderDecoration: function (props, editor, next) {
            return opts.renderDecoration({
                children: props.children,
                decoration: props.decoration,
            }, editor, next);
        },
    };
}
/**
 * Returns the decoration for a node
 */
function decorateNode(opts, tokens, block) {
    var texts = block.getTexts();
    // The list of decorations to return
    var decorations = [];
    var textStart = 0;
    var textEnd = 0;
    texts.forEach(function (text) {
        textEnd = textStart + text.getText().length;
        var offset = 0;
        function processToken(token, accu) {
            if (typeof token === 'string') {
                if (accu) {
                    var decoration = createDecoration({
                        text: text,
                        textStart: textStart,
                        textEnd: textEnd,
                        start: offset,
                        end: offset + token.length,
                        className: "prism-token token " + accu,
                        block: block,
                    });
                    if (decoration) {
                        decorations.push(decoration);
                    }
                }
                offset += token.length;
            }
            else {
                accu = accu + " " + token.type;
                if (token.alias) {
                    accu += ' ' + token.alias;
                }
                if (typeof token.content === 'string') {
                    var decoration = createDecoration({
                        text: text,
                        textStart: textStart,
                        textEnd: textEnd,
                        start: offset,
                        end: offset + token.content.length,
                        className: "prism-token token " + accu,
                        block: block,
                    });
                    if (decoration) {
                        decorations.push(decoration);
                    }
                    offset += token.content.length;
                }
                else {
                    // When using token.content instead of token.matchedStr, token can be deep
                    for (var i = 0; i < token.content.length; i += 1) {
                        // @ts-ignore
                        processToken(token.content[i], accu);
                    }
                }
            }
        }
        tokens.forEach(processToken);
        textStart = textEnd + 1; // account for added `\n`
    });
    return decorations;
}
/**
 * Return a decoration range for the given text.
 */
function createDecoration(_a) {
    var text = _a.text, textStart = _a.textStart, textEnd = _a.textEnd, start = _a.start, end = _a.end, className = _a.className, block = _a.block;
    if (start >= textEnd || end <= textStart) {
        // Ignore, the token is not in the text
        return null;
    }
    // Shrink to this text boundaries
    start = Math.max(start, textStart);
    end = Math.min(end, textEnd);
    // Now shift offsets to be relative to this text
    start -= textStart;
    end -= textStart;
    var myDec = block.createDecoration({
        object: 'decoration',
        anchor: {
            key: text.key,
            offset: start,
            object: 'point',
        },
        focus: {
            key: text.key,
            offset: end,
            object: 'point',
        },
        type: TOKEN_MARK,
        data: { className: className },
    });
    return myDec;
}
function flattenToken(token) {
    if (typeof token === 'string') {
        return [
            {
                content: token,
                types: [],
                aliases: [],
            },
        ];
    }
    else if (Array.isArray(token)) {
        return token.flatMap(function (t) { return flattenToken(t); });
    }
    else if (token instanceof Prism.Token) {
        return flattenToken(token.content).flatMap(function (t) {
            var _a;
            var aliases = [];
            if (typeof token.alias === 'string') {
                aliases = [token.alias];
            }
            else {
                aliases = (_a = token.alias) !== null && _a !== void 0 ? _a : [];
            }
            return {
                content: t.content,
                types: __spreadArray([token.type], __read(t.types), false),
                aliases: __spreadArray(__spreadArray([], __read(aliases), false), __read(t.aliases), false),
            };
        });
    }
    return [];
}
export function flattenTokens(token) {
    var tokens = flattenToken(token);
    if (!tokens.length) {
        return [];
    }
    var firstToken = tokens[0];
    firstToken.prev = null;
    firstToken.next = tokens.length >= 2 ? tokens[1] : null;
    firstToken.offsets = {
        start: 0,
        end: firstToken.content.length,
    };
    for (var i = 1; i < tokens.length - 1; i++) {
        tokens[i].prev = tokens[i - 1];
        tokens[i].next = tokens[i + 1];
        tokens[i].offsets = {
            start: tokens[i - 1].offsets.end,
            end: tokens[i - 1].offsets.end + tokens[i].content.length,
        };
    }
    var lastToken = tokens[tokens.length - 1];
    lastToken.prev = tokens.length >= 2 ? tokens[tokens.length - 2] : null;
    lastToken.next = null;
    lastToken.offsets = {
        start: tokens.length >= 2 ? tokens[tokens.length - 2].offsets.end : 0,
        end: tokens.length >= 2 ? tokens[tokens.length - 2].offsets.end + lastToken.content.length : lastToken.content.length,
    };
    return tokens;
}
//# sourceMappingURL=index.js.map