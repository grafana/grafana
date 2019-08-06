import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor } from 'slate';

import { isKeyHotkey } from 'is-hotkey';

const isSelectLeftHotkey = isKeyHotkey('shift+left');
const isSelectRightHotkey = isKeyHotkey('shift+right');
const isSelectUpHotkey = isKeyHotkey('shift+up');
const isSelectDownHotkey = isKeyHotkey('shift+down');
const isSelectLineHotkey = isKeyHotkey('mod+l');

const handleSelectVertical = (editor: CoreEditor, direction: 'up' | 'down') => {
  const { focusBlock } = editor.value;
  const adjacentBlock =
    direction === 'up'
      ? editor.value.document.getPreviousBlock(focusBlock.key)
      : editor.value.document.getNextBlock(focusBlock.key);

  if (!adjacentBlock) {
    return true;
  }
  const adjacentText = adjacentBlock.getFirstText();
  editor
    .moveFocusTo(adjacentText.key, Math.min(editor.value.selection.anchor.offset, adjacentText.text.length))
    .focus();
  return true;
};

const handleSelectUp = (editor: CoreEditor) => handleSelectVertical(editor, 'up');

const handleSelectDown = (editor: CoreEditor) => handleSelectVertical(editor, 'down');

// Clears the rest of the line after the caret
export default function SelectionShortcutsPlugin(): Plugin {
  return {
    onKeyDown(event: KeyboardEvent, editor: CoreEditor, next: Function) {
      if (isSelectLeftHotkey(event)) {
        event.preventDefault();
        if (editor.value.selection.focus.offset > 0) {
          editor.moveFocusBackward(1);
        }
      } else if (isSelectRightHotkey(event)) {
        event.preventDefault();
        if (editor.value.selection.focus.offset < editor.value.startText.text.length) {
          editor.moveFocusForward(1);
        }
      } else if (isSelectUpHotkey(event)) {
        event.preventDefault();
        handleSelectUp(editor);
      } else if (isSelectDownHotkey(event)) {
        event.preventDefault();
        handleSelectDown(editor);
      } else if (isSelectLineHotkey(event)) {
        event.preventDefault();
        const { focusBlock, document } = editor.value;

        editor.moveAnchorToStartOfBlock();

        const nextBlock = document.getNextBlock(focusBlock.key);
        if (nextBlock) {
          editor.moveFocusToStartOfNextBlock();
        } else {
          editor.moveFocusToEndOfText();
        }
      } else {
        return next();
      }

      return true;
    },
  };
}
