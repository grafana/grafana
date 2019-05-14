// Clears the rest of the line after the caret
export default function ClearPlugin() {
    return {
        onKeyDown: function (event, change) {
            var value = change.value;
            if (!value.isCollapsed) {
                return undefined;
            }
            if (event.key === 'k' && event.ctrlKey) {
                event.preventDefault();
                var text = value.anchorText.text;
                var offset = value.anchorOffset;
                var length_1 = text.length;
                var forward = length_1 - offset;
                change.deleteForward(forward);
                return true;
            }
            return undefined;
        },
    };
}
//# sourceMappingURL=clear.js.map