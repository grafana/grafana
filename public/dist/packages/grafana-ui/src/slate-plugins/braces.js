import { v4 as uuidv4 } from 'uuid';
var BRACES = {
    '[': ']',
    '{': '}',
    '(': ')',
};
var MATCH_MARK = 'brace_match';
export function BracesPlugin() {
    return {
        onKeyDown: function (event, editor, next) {
            var keyEvent = event;
            var value = editor.value;
            switch (keyEvent.key) {
                case '(':
                case '{':
                case '[': {
                    var _a = value.selection, _b = _a.start, startOffset = _b.offset, startKey = _b.key, _c = _a.end, endOffset = _c.offset, endKey = _c.key, focusOffset = _a.focus.offset;
                    var text = value.focusText.text;
                    // If text is selected, wrap selected text in parens
                    if (value.selection.isExpanded) {
                        keyEvent.preventDefault();
                        editor
                            .insertTextByKey(startKey, startOffset, keyEvent.key)
                            .insertTextByKey(endKey, endOffset + 1, BRACES[keyEvent.key])
                            .moveEndBackward(1);
                        return true;
                    }
                    else if (
                    // Insert matching brace when there is no input after caret
                    focusOffset === text.length ||
                        text[focusOffset] === ' ' ||
                        Object.values(BRACES).includes(text[focusOffset])) {
                        keyEvent.preventDefault();
                        var complement = BRACES[keyEvent.key];
                        var matchAnnotation = {
                            key: MATCH_MARK + "-" + uuidv4(),
                            type: MATCH_MARK + "-" + complement,
                            anchor: {
                                key: startKey,
                                offset: startOffset,
                                object: 'point',
                            },
                            focus: {
                                key: endKey,
                                offset: endOffset + 1,
                                object: 'point',
                            },
                            object: 'annotation',
                        };
                        editor.insertText(keyEvent.key).insertText(complement).addAnnotation(matchAnnotation).moveBackward(1);
                        return true;
                    }
                    break;
                }
                case ')':
                case '}':
                case ']': {
                    var text = value.anchorText.text;
                    var offset = value.selection.anchor.offset;
                    var nextChar = text[offset];
                    // Handle closing brace when it's already the next character
                    var complement = keyEvent.key;
                    var annotationType_1 = MATCH_MARK + "-" + complement;
                    var annotation = value.annotations.find(function (a) { return (a === null || a === void 0 ? void 0 : a.type) === annotationType_1 && a.anchor.key === value.anchorText.key; });
                    if (annotation && nextChar === complement && !value.selection.isExpanded) {
                        keyEvent.preventDefault();
                        editor.moveFocusForward(1).removeAnnotation(annotation).moveAnchorForward(1);
                        return true;
                    }
                    break;
                }
                case 'Backspace': {
                    var text = value.anchorText.text;
                    var offset = value.selection.anchor.offset;
                    var previousChar = text[offset - 1];
                    var nextChar = text[offset];
                    if (BRACES[previousChar] && BRACES[previousChar] === nextChar) {
                        keyEvent.preventDefault();
                        // Remove closing brace if directly following
                        editor.deleteBackward(1).deleteForward(1).focus();
                        return true;
                    }
                }
                default: {
                    break;
                }
            }
            return next();
        },
    };
}
//# sourceMappingURL=braces.js.map