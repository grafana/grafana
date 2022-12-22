import { Plugin } from 'slate-react';

// Clears the rest of the line after the caret
export function ClearPlugin(): Plugin {
  return {
    onKeyDown(event, editor, next) {
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
