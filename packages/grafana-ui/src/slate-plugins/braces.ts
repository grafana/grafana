import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor, Annotation } from 'slate';

const BRACES: any = {
  '[': ']',
  '{': '}',
  '(': ')',
};

const MATCH_MARK = 'brace_match';

export function BracesPlugin(): Plugin {
  return {
    onKeyDown(event: Event, editor: CoreEditor, next: Function) {
      const keyEvent = event as KeyboardEvent;
      const { value } = editor;

      switch (keyEvent.key) {
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
            keyEvent.preventDefault();
            editor
              .insertTextByKey(startKey, startOffset, keyEvent.key)
              .insertTextByKey(endKey, endOffset + 1, BRACES[keyEvent.key])
              .moveEndBackward(1);
            return true;
          } else if (
            // Insert matching brace when there is no input after caret
            focusOffset === text.length ||
            text[focusOffset] === ' ' ||
            Object.values(BRACES).includes(text[focusOffset])
          ) {
            keyEvent.preventDefault();
            const complement = BRACES[keyEvent.key];
            const matchAnnotation = {
              key: `${MATCH_MARK}-${Date.now()}`,
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
            editor
              .insertText(keyEvent.key)
              .insertText(complement)
              .addAnnotation(matchAnnotation)
              .moveBackward(1);

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
          const complement = keyEvent.key;
          const annotationType = `${MATCH_MARK}-${complement}`;
          const annotation = value.annotations.find(
            a => a?.type === annotationType && a.anchor.key === value.anchorText.key
          );
          if (annotation && nextChar === complement && !value.selection.isExpanded) {
            keyEvent.preventDefault();
            editor
              .moveFocusForward(1)
              .removeAnnotation(annotation)
              .moveAnchorForward(1);
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
