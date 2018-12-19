const BRACES = {
  '[': ']',
  '{': '}',
  '(': ')',
};

const NON_SELECTOR_SPACE_REGEXP = / (?![^}]+})/;

export default function BracesPlugin() {
  return {
    onKeyDown(event, change) {
      const { value } = change;
      if (!value.isCollapsed) {
        return undefined;
      }

      switch (event.key) {
        case '{':
        case '[': {
          event.preventDefault();
          // Insert matching braces
          change
            .insertText(`${event.key}${BRACES[event.key]}`)
            .move(-1)
            .focus();
          return true;
        }

        case '(': {
          event.preventDefault();
          const text = value.anchorText.text;
          const offset = value.anchorOffset;
          const delimiterIndex = text.slice(offset).search(NON_SELECTOR_SPACE_REGEXP);
          const length = delimiterIndex > -1 ? delimiterIndex + offset : text.length;
          const forward = length - offset;
          // Insert matching braces
          change
            .insertText(event.key)
            .move(forward)
            .insertText(BRACES[event.key])
            .move(-1 - forward)
            .focus();
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
