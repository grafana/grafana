import { Annotation } from 'slate';
import { Plugin } from 'slate-react';
import { v4 as uuidv4 } from 'uuid';

const BRACES: Record<string, string> = {
  '[': ']',
  '{': '}',
  '(': ')',
};

const MATCH_MARK = 'brace_match';

export function BracesPlugin(): Plugin {
  return {
    onKeyDown(event, editor, next) {
      const { value } = editor;

      switch (event.key) {
        case '(':
        case '{':
        case '[': {
          const {
            start: { offset: startOffset, key: startKey },
            end: { offset: endOffset, key: endKey },
            focus: { offset: focusOffset },
          } = value.selection;
          const text = value.focusText.text;

          // If text is selected, wrap selected text in parens
          if (value.selection.isExpanded) {
            event.preventDefault();
            editor
              .insertTextByKey(startKey, startOffset, event.key)
              .insertTextByKey(endKey, endOffset + 1, BRACES[event.key])
              .moveEndBackward(1);
            return true;
          } else if (
            // Insert matching brace when there is no input after caret
            focusOffset === text.length ||
            text[focusOffset] === ' ' ||
            Object.values(BRACES).includes(text[focusOffset])
          ) {
            event.preventDefault();
            const complement = BRACES[event.key];
            const matchAnnotation = {
              key: `${MATCH_MARK}-${uuidv4()}`,
              type: `${MATCH_MARK}-${complement}`,
              anchor: {
                key: startKey,
                offset: startOffset,
                object: 'point',
              },
              focus: {
                key: endKey,
                offset: endOffset + 1,
                object: 'point',
              },
              object: 'annotation',
            } as Annotation;
            editor.insertText(event.key).insertText(complement).addAnnotation(matchAnnotation).moveBackward(1);

            return true;
          }
          break;
        }

        case ')':
        case '}':
        case ']': {
          const text = value.anchorText.text;
          const offset = value.selection.anchor.offset;
          const nextChar = text[offset];
          // Handle closing brace when it's already the next character
          const complement = event.key;
          const annotationType = `${MATCH_MARK}-${complement}`;
          const annotation = value.annotations.find(
            (a) => a?.type === annotationType && a.anchor.key === value.anchorText.key
          );
          if (annotation && nextChar === complement && !value.selection.isExpanded) {
            event.preventDefault();
            editor.moveFocusForward(1).removeAnnotation(annotation).moveAnchorForward(1);
            return true;
          }
          break;
        }

        case 'Backspace': {
          const text = value.anchorText.text;
          const offset = value.selection.anchor.offset;
          const previousChar = text[offset - 1];
          const nextChar = text[offset];
          if (BRACES[previousChar] && BRACES[previousChar] === nextChar) {
            event.preventDefault();
            // Remove closing brace if directly following
            editor.deleteBackward(1).deleteForward(1).focus();
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
