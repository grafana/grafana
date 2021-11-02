function getIndent(text) {
    var offset = text.length - text.trimLeft().length;
    if (offset) {
        var indent = text[0];
        while (--offset) {
            indent += text[0];
        }
        return indent;
    }
    return '';
}
export function NewlinePlugin() {
    return {
        onKeyDown: function (event, editor, next) {
            var keyEvent = event;
            var value = editor.value;
            if (value.selection.isExpanded) {
                return next();
            }
            if (keyEvent.key === 'Enter') {
                keyEvent.preventDefault();
                var startBlock = value.startBlock;
                var currentLineText = startBlock.text;
                var indent = getIndent(currentLineText);
                return editor.splitBlock().insertText(indent).focus();
            }
            return next();
        },
    };
}
//# sourceMappingURL=newline.js.map