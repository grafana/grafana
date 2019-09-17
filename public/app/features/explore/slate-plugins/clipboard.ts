import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor } from 'slate';

const getCopiedText = (textBlocks: string[], startOffset: number, endOffset: number) => {
  if (!textBlocks.length) {
    return undefined;
  }

  const excludingLastLineLength = textBlocks.slice(0, -1).join('').length + textBlocks.length - 1;
  return textBlocks.join('\n').slice(startOffset, excludingLastLineLength + endOffset);
};

export default function ClipboardPlugin(): Plugin {
  const clipboardPlugin = {
    onCopy(event: ClipboardEvent, editor: CoreEditor) {
      event.preventDefault();

      const { document, selection } = editor.value;
      const {
        start: { offset: startOffset },
        end: { offset: endOffset },
      } = selection;
      const selectedBlocks = document
        .getLeafBlocksAtRange(selection)
        .toArray()
        .map(block => block.text);

      const copiedText = getCopiedText(selectedBlocks, startOffset, endOffset);
      if (copiedText) {
        event.clipboardData.setData('Text', copiedText);
      }

      return true;
    },

    onPaste(event: ClipboardEvent, editor: CoreEditor) {
      event.preventDefault();
      const pastedValue = event.clipboardData.getData('Text');
      const lines = pastedValue.split('\n');

      if (lines.length) {
        editor.insertText(lines[0]);
        for (const line of lines.slice(1)) {
          editor.splitBlock().insertText(line);
        }
      }

      return true;
    },
  };

  return {
    ...clipboardPlugin,
    onCut(event: ClipboardEvent, editor: CoreEditor) {
      clipboardPlugin.onCopy(event, editor);
      editor.deleteAtRange(editor.value.selection);

      return true;
    },
  };
}
