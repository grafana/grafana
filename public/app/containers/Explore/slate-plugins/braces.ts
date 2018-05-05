const BRACES = {
  '[': ']',
  '{': '}',
  '(': ')',
};

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
          const space = text.indexOf(' ', offset);
          const length = space > 0 ? space : text.length;
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

        default: {
          break;
        }
      }
      return undefined;
    },
  };
}
