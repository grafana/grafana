import { type EditorView } from '@codemirror/view';

/** Wraps the selection (or the caret) in `before`/`after`, keeping it selected. */
export function surroundSelection(view: EditorView, before: string, after = before) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  });
}

export function insertAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
}

/** Prefixes every line touched by the selection, e.g. for headings and lists. */
export function prefixSelectedLines(view: EditorView, prefix: string) {
  const { state } = view;
  const { from, to } = state.selection.main;
  const startLine = state.doc.lineAt(from).number;
  const endLine = state.doc.lineAt(to).number;

  const changes = [];
  for (let n = startLine; n <= endLine; n++) {
    changes.push({ from: state.doc.line(n).from, insert: prefix });
  }

  // Map the selection rightward so the caret lands after the inserted prefix.
  const changeSet = state.changes(changes);
  view.dispatch({ changes: changeSet, selection: state.selection.map(changeSet, 1) });
}
