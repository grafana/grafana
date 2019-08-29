// @ts-ignore
import { Change } from 'slate';

const BRACES: any = {
  '[': ']',
  '{': '}',
  '(': ')',
};

export default function BracesPlugin() {
  return {
    onKeyDown(event: KeyboardEvent, change: Change) {
      const { value } = change;

      switch (event.key) {
        case '(':
        case '{':
        case '[': {
          event.preventDefault();

          const { startOffset, startKey, endOffset, endKey, focusOffset } = value.selection;
          const text: string = value.focusText.text;

          // If text is selected, wrap selected text in parens
          if (value.isExpanded) {
            change
              .insertTextByKey(startKey, startOffset, event.key)
              .insertTextByKey(endKey, endOffset + 1, BRACES[event.key])
              .moveEnd(-1);
          } else if (
            focusOffset === text.length ||
            text[focusOffset] === ' ' ||
            Object.values(BRACES).includes(text[focusOffset])
          ) {
            change.insertText(`${event.key}${BRACES[event.key]}`).move(-1);
          } else {
            change.insertText(event.key);
          }

          return true;
        }

        case 'Backspace': {
          const text = value.anchorText.text;
          const offset = value.anchorOffset;
          const previousChar = text[offset - 1];
          const nextChar = text[offset];
          if (BRACES[previousChar] && BRACES[previousChar] === nextChar) {
            event.preventDefault();
            // Remove closing brace if directly following
            change
              .deleteBackward()
              .deleteForward()
              .focus();
            return true;
          }
        }

        default: {
          break;
        }
      }
      return undefined;
    },
  };
}
