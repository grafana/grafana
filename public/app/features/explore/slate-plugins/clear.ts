// Clears the rest of the line after the caret
export default function ClearPlugin() {
  return {
    onKeyDown(event, change) {
      const { value } = change;
      if (!value.isCollapsed) {
        return undefined;
      }

      if (event.key === 'k' && event.ctrlKey) {
        event.preventDefault();
        const text = value.anchorText.text;
        const offset = value.anchorOffset;
        const length = text.length;
        const forward = length - offset;
        change.deleteForward(forward);
        return true;
      }
      return undefined;
    },
  };
}
