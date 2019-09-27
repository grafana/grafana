import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor } from 'slate';

// Clears the rest of the line after the caret
export default function ClearPlugin(): Plugin {
  return {
    onKeyDown(event: KeyboardEvent, editor: CoreEditor, next: Function) {
      const value = editor.value;

      if (value.selection.isExpanded) {
        return next();
      }

      if (event.key === 'k' && event.ctrlKey) {
        event.preventDefault();
        const text = value.anchorText.text;
        const offset = value.selection.anchor.offset;
        const length = text.length;
        const forward = length - offset;
        editor.deleteForward(forward);
        return true;
      }

      return next();
    },
  };
}
