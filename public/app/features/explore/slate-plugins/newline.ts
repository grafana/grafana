function getIndent(text) {
  let offset = text.length - text.trimLeft().length;
  if (offset) {
    let indent = text[0];
    while (--offset) {
      indent += text[0];
    }
    return indent;
  }
  return '';
}

export default function NewlinePlugin() {
  return {
    onKeyDown(event, change) {
      const { value } = change;
      if (!value.isCollapsed) {
        return undefined;
      }

      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();

        const { startBlock } = value;
        const currentLineText = startBlock.text;
        const indent = getIndent(currentLineText);

        return change
          .splitBlock()
          .insertText(indent)
          .focus();
      }
    },
  };
}
