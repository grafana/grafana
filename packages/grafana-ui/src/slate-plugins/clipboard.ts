import { Plugin } from 'slate-react';

const getCopiedText = (textBlocks: string[], startOffset: number, endOffset: number) => {
  if (!textBlocks.length) {
    return undefined;
  }

  const excludingLastLineLength = textBlocks.slice(0, -1).join('').length + textBlocks.length - 1;
  return textBlocks.join('\n').slice(startOffset, excludingLastLineLength + endOffset);
};

// Remove unicode special symbol - byte order mark (BOM), U+FEFF.
const removeBom = (str: string | undefined): string | undefined => {
  return str?.replace(/[\uFEFF]/g, '');
};

export function ClipboardPlugin(): Plugin {
  const clipboardPlugin: Plugin = {
    onCopy(event, editor, next) {
      event.preventDefault();

      const { document, selection } = editor.value;
      const {
        start: { offset: startOffset },
        end: { offset: endOffset },
      } = selection;
      const selectedBlocks = document
        .getLeafBlocksAtRange(selection)
        .toArray()
        .map((block) => block.text);

      const copiedText = removeBom(getCopiedText(selectedBlocks, startOffset, endOffset));
      if (copiedText && event.clipboardData) {
        event.clipboardData.setData('Text', copiedText);
      }

      return true;
    },

    onPaste(event, editor, next) {
      event.preventDefault();
      if (event.clipboardData) {
        const pastedValue = removeBom(event.clipboardData.getData('Text'));
        const lines = pastedValue?.split('\n');

        if (lines && lines.length) {
          editor.insertText(lines[0]);
          for (const line of lines.slice(1)) {
            editor.splitBlock().insertText(line);
          }
        }
      }

      return true;
    },
  };

  return {
    ...clipboardPlugin,
    onCut(event, editor, next) {
      clipboardPlugin.onCopy!(event, editor, next);
      editor.deleteAtRange(editor.value.selection);

      return true;
    },
  };
}
