import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor } from 'slate';

const BRACES: any = {
  '[': ']',
  '{': '}',
  '(': ')',
};

export function BracesPlugin(): Plugin {
  return {
    onKeyDown(event: Event, editor: CoreEditor, next: Function) {
      const keyEvent = event as KeyboardEvent;
      const { value } = editor;

      switch (keyEvent.key) {
        case '(':
        case '{':
        case '[': {
          keyEvent.preventDefault();
          const {
            start: { offset: startOffset, key: startKey },
            end: { offset: endOffset, key: endKey },
            focus: { offset: focusOffset },
          } = value.selection;
          const text = value.focusText.text;

          // If text is selected, wrap selected text in parens
          if (value.selection.isExpanded) {
            editor
              .insertTextByKey(startKey, startOffset, keyEvent.key)
              .insertTextByKey(endKey, endOffset + 1, BRACES[keyEvent.key])
              .moveEndBackward(1);
          } else if (
            focusOffset === text.length ||
            text[focusOffset] === ' ' ||
            Object.values(BRACES).includes(text[focusOffset])
          ) {
            editor.insertText(`${keyEvent.key}${BRACES[keyEvent.key]}`).moveBackward(1);
          } else {
            editor.insertText(keyEvent.key);
          }

          return true;
        }

        case 'Backspace': {
          const text = value.anchorText.text;
          const offset = value.selection.anchor.offset;
          const previousChar = text[offset - 1];
          const nextChar = text[offset];
          if (BRACES[previousChar] && BRACES[previousChar] === nextChar) {
            keyEvent.preventDefault();
            // Remove closing brace if directly following
            editor
              .deleteBackward(1)
              .deleteForward(1)
              .focus();
            return true;
          }
        }

        default: {
          break;
        }
      }

      return next();
    },
  };
}
