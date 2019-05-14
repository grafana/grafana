var BRACES = {
    '[': ']',
    '{': '}',
    '(': ')',
};
var NON_SELECTOR_SPACE_REGEXP = / (?![^}]+})/;
export default function BracesPlugin() {
    return {
        onKeyDown: function (event, change) {
            var value = change.value;
            if (!value.isCollapsed) {
                return undefined;
            }
            switch (event.key) {
                case '{':
                case '[': {
                    event.preventDefault();
                    // Insert matching braces
                    change
                        .insertText("" + event.key + BRACES[event.key])
                        .move(-1)
                        .focus();
                    return true;
                }
                case '(': {
                    event.preventDefault();
                    var text = value.anchorText.text;
                    var offset = value.anchorOffset;
                    var delimiterIndex = text.slice(offset).search(NON_SELECTOR_SPACE_REGEXP);
                    var length_1 = delimiterIndex > -1 ? delimiterIndex + offset : text.length;
                    var forward = length_1 - offset;
                    // Insert matching braces
                    change
                        .insertText(event.key)
                        .move(forward)
                        .insertText(BRACES[event.key])
                        .move(-1 - forward)
                        .focus();
                    return true;
                }
                case 'Backspace': {
                    var text = value.anchorText.text;
                    var offset = value.anchorOffset;
                    var previousChar = text[offset - 1];
                    var nextChar = text[offset];
                    if (BRACES[previousChar] && BRACES[previousChar] === nextChar) {
                        event.preventDefault();
                        // Remove closing brace if directly following
                        change
                            .deleteBackward()
                            .deleteForward()
                            .focus();
                        return true;
                    }
                }
                default: {
                    break;
                }
            }
            return undefined;
        },
    };
}
//# sourceMappingURL=braces.js.map