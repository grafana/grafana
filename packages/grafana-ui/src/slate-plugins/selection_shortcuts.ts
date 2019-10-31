import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor } from 'slate';

import { isKeyHotkey } from 'is-hotkey';

const isSelectLineHotkey = isKeyHotkey('mod+l');

// Clears the rest of the line after the caret
export function SelectionShortcutsPlugin(): Plugin {
  return {
    onKeyDown(event: Event, editor: CoreEditor, next: () => any) {
      const keyEvent = event as KeyboardEvent;
      if (isSelectLineHotkey(keyEvent)) {
        keyEvent.preventDefault();
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
