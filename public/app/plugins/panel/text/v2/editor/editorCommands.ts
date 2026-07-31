import { type EditorView } from '@codemirror/view';

/** Wraps the selection (or the caret) in `before`/`after`, keeping it selected. */
export function surroundSelection(view: EditorView, before: string, after = before) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  });
  view.focus();
}

export function insertAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
  view.focus();
}

/** Prefixes every line touched by the selection, e.g. for headings and lists. */
export function prefixSelectedLines(view: EditorView, prefix: string) {
  const { state } = view;
  const range = state.selection.main;
  const startLine = state.doc.lineAt(range.from).number;
  // A selection ending exactly at a line start (Shift+Down, or dragging through a
  // trailing newline) does not touch that line, so it must not be prefixed.
  const endPos = !range.empty && range.to === state.doc.lineAt(range.to).from ? range.to - 1 : range.to;
  const endLine = state.doc.lineAt(endPos).number;

  const changes = [];
  for (let n = startLine; n <= endLine; n++) {
    changes.push({ from: state.doc.line(n).from, insert: prefix });
  }

  // Map the selection rightward so the caret lands after the inserted prefix.
  const changeSet = state.changes(changes);
  view.dispatch({ changes: changeSet, selection: state.selection.map(changeSet, 1) });
  view.focus();
}
