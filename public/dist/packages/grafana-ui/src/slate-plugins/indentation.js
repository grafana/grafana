import { __values } from "tslib";
import { Range as SlateRange } from 'slate';
import { isKeyHotkey } from 'is-hotkey';
var isIndentLeftHotkey = isKeyHotkey('mod+[');
var isShiftTabHotkey = isKeyHotkey('shift+tab');
var isIndentRightHotkey = isKeyHotkey('mod+]');
var SLATE_TAB = '  ';
var handleTabKey = function (event, editor, next) {
    var _a = editor.value, startBlock = _a.startBlock, endBlock = _a.endBlock, _b = _a.selection, _c = _b.start, startOffset = _c.offset, startKey = _c.key, _d = _b.end, endOffset = _d.offset, endKey = _d.key;
    var first = startBlock.getFirstText();
    var startBlockIsSelected = first && startOffset === 0 && startKey === first.key && endOffset === first.text.length && endKey === first.key;
    if (startBlockIsSelected || !startBlock.equals(endBlock)) {
        handleIndent(editor, 'right');
    }
    else {
        editor.insertText(SLATE_TAB);
    }
};
var handleIndent = function (editor, indentDirection) {
    var e_1, _a, e_2, _b;
    var curSelection = editor.value.selection;
    var selectedBlocks = editor.value.document.getLeafBlocksAtRange(curSelection).toArray();
    if (indentDirection === 'left') {
        try {
            for (var selectedBlocks_1 = __values(selectedBlocks), selectedBlocks_1_1 = selectedBlocks_1.next(); !selectedBlocks_1_1.done; selectedBlocks_1_1 = selectedBlocks_1.next()) {
                var block = selectedBlocks_1_1.value;
                var blockWhitespace = block.text.length - block.text.trimLeft().length;
                var textKey = block.getFirstText().key;
                var rangeProperties = {
                    anchor: {
                        key: textKey,
                        offset: blockWhitespace,
                        path: [],
                    },
                    focus: {
                        key: textKey,
                        offset: blockWhitespace,
                        path: [],
                    },
                };
                editor.deleteBackwardAtRange(SlateRange.create(rangeProperties), Math.min(SLATE_TAB.length, blockWhitespace));
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (selectedBlocks_1_1 && !selectedBlocks_1_1.done && (_a = selectedBlocks_1.return)) _a.call(selectedBlocks_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    else {
        var startText = editor.value.startText;
        var textBeforeCaret = startText.text.slice(0, curSelection.start.offset);
        var isWhiteSpace = /^\s*$/.test(textBeforeCaret);
        try {
            for (var selectedBlocks_2 = __values(selectedBlocks), selectedBlocks_2_1 = selectedBlocks_2.next(); !selectedBlocks_2_1.done; selectedBlocks_2_1 = selectedBlocks_2.next()) {
                var block = selectedBlocks_2_1.value;
                editor.insertTextByKey(block.getFirstText().key, 0, SLATE_TAB);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (selectedBlocks_2_1 && !selectedBlocks_2_1.done && (_b = selectedBlocks_2.return)) _b.call(selectedBlocks_2);
            }
            finally { if (e_2) throw e_2.error; }
        }
        if (isWhiteSpace) {
            editor.moveStartBackward(SLATE_TAB.length);
        }
    }
};
// Clears the rest of the line after the caret
export function IndentationPlugin() {
    return {
        onKeyDown: function (event, editor, next) {
            var keyEvent = event;
            if (isIndentLeftHotkey(keyEvent) || isShiftTabHotkey(keyEvent)) {
                keyEvent.preventDefault();
                handleIndent(editor, 'left');
            }
            else if (isIndentRightHotkey(keyEvent)) {
                keyEvent.preventDefault();
                handleIndent(editor, 'right');
            }
            else if (keyEvent.key === 'Tab') {
                keyEvent.preventDefault();
                handleTabKey(keyEvent, editor, next);
            }
            else {
                return next();
            }
            return true;
        },
    };
}
//# sourceMappingURL=indentation.js.map