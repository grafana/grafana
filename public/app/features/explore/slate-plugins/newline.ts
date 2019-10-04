import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor } from 'slate';

function getIndent(text: string) {
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

export default function NewlinePlugin(): Plugin {
  return {
    onKeyDown(event: KeyboardEvent, editor: CoreEditor, next: Function) {
      const value = editor.value;

      if (value.selection.isExpanded) {
        return next();
      }

      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();

        const { startBlock } = value;
        const currentLineText = startBlock.text;
        const indent = getIndent(currentLineText);

        return editor
          .splitBlock()
          .insertText(indent)
          .focus();
      }

      return next();
    },
  };
}
