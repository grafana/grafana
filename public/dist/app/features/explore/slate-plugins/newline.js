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
export default function NewlinePlugin() {
    return {
        onKeyDown: function (event, change) {
            var value = change.value;
            if (!value.isCollapsed) {
                return undefined;
            }
            if (event.key === 'Enter' && event.shiftKey) {
                event.preventDefault();
                var startBlock = value.startBlock;
                var currentLineText = startBlock.text;
                var indent = getIndent(currentLineText);
                return change
                    .splitBlock()
                    .insertText(indent)
                    .focus();
            }
        },
    };
}
//# sourceMappingURL=newline.js.map