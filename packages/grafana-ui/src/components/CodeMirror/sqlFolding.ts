import { foldService } from '@codemirror/language';
import { countColumn } from '@codemirror/state';

const getIndentation = (text: string, tabSize: number) => {
  const indentationEnd = text.search(/\S|$/);
  return countColumn(text, tabSize, indentationEnd);
};

// Adds indentation-based folding for SQL because its syntax tree only provides fold ranges for SELECT clauses.
export const foldByIndentation = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart);

  if (line.number === state.doc.lines || line.text.trim().length === 0) {
    return null;
  }

  const indentation = getIndentation(line.text, state.tabSize);
  let foldEnd: number | undefined;

  for (let lineNumber = line.number + 1; lineNumber <= state.doc.lines; lineNumber++) {
    const nextLine = state.doc.line(lineNumber);

    if (nextLine.text.trim().length === 0) {
      continue;
    }

    if (getIndentation(nextLine.text, state.tabSize) <= indentation) {
      break;
    }

    foldEnd = nextLine.to;
  }

  return foldEnd === undefined ? null : { from: line.to, to: foldEnd };
});
