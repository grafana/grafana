import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor } from 'slate';

import { isKeyHotkey } from 'is-hotkey';

const isSelectLineHotkey = isKeyHotkey('mod+l');

// Clears the rest of the line after the caret
export default function SelectionShortcutsPlugin(): Plugin {
  return {
    onKeyDown(event: KeyboardEvent, editor: CoreEditor, next: Function) {
      if (isSelectLineHotkey(event)) {
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
