import { type EditorState } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';

/** Whether `before`/`after` sit immediately outside the range. */
function isWrapped(state: EditorState, from: number, to: number, before: string, after: string) {
  const slice = (start: number, end: number) => state.sliceDoc(Math.max(0, start), Math.min(state.doc.length, end));

  const leading = slice(from - 2 * before.length, from);
  const trailing = slice(to, to + 2 * after.length);
  const inner = state.sliceDoc(from, to);

  return (
    leading.endsWith(before) &&
    trailing.startsWith(after) &&
    // `*` also matches half of a `**` pair, so a marker beside another marker is a longer run.
    !leading.endsWith(before + before) &&
    !trailing.startsWith(after + after) &&
    !inner.startsWith(before) &&
    !inner.endsWith(after)
  );
}

/** Wraps the selection (or caret) in `before`/`after`, or strips them when already applied. */
export function toggleSurround(view: EditorView, before: string, after = before) {
  const { state } = view;
  const { from, to } = state.selection.main;

  // Also match when the markers are part of the selection, e.g. all of `**bold**`.
  const candidates = [
    { from, to },
    { from: from + before.length, to: to - after.length },
  ];

  const marked = candidates.find(
    (range) => range.from <= range.to && isWrapped(state, range.from, range.to, before, after)
  );

  if (marked) {
    view.dispatch({
      changes: [
        { from: marked.from - before.length, to: marked.from },
        { from: marked.to, to: marked.to + after.length },
      ],
      selection: { anchor: marked.from - before.length, head: marked.to - before.length },
    });
  } else {
    const selected = state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    });
  }

  view.focus();
}

export function insertAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
  view.focus();
}

/**
 * Ordered so `- [ ] ` matches before the `- ` it starts with. A prefix missing here
 * can be added but never removed.
 */
const LINE_MARKERS = [
  { kind: 'heading', pattern: /^#{1,6} / },
  { kind: 'checklist', pattern: /^- \[[ xX]\] / },
  { kind: 'bullet', pattern: /^- / },
  { kind: 'numbered', pattern: /^\d+\. / },
];

function matchMarker(text: string) {
  for (const { kind, pattern } of LINE_MARKERS) {
    const match = pattern.exec(text);
    if (match) {
      return { kind, length: match[0].length };
    }
  }
  return undefined;
}

/** Prefixes every line the selection touches, replacing any other marker or clearing its own. */
export function toggleLinePrefix(view: EditorView, prefix: string) {
  const { state } = view;
  const range = state.selection.main;
  const startLine = state.doc.lineAt(range.from).number;
  // A selection ending exactly at a line start (Shift+Down, or dragging through a
  // trailing newline) does not touch that line, so it must not be prefixed.
  const endPos = !range.empty && range.to === state.doc.lineAt(range.to).from ? range.to - 1 : range.to;
  const endLine = state.doc.lineAt(endPos).number;

  const lines = [];
  for (let n = startLine; n <= endLine; n++) {
    lines.push(state.doc.line(n));
  }

  const target = matchMarker(prefix);
  const markers = lines.map((line) => matchMarker(line.text));

  // A partially prefixed selection is completed, not half-cleared.
  const allPrefixed = target !== undefined && markers.every((marker) => marker?.kind === target.kind);
  const changes = lines.map((line, i) => {
    const markerEnd = line.from + (markers[i]?.length ?? 0);
    return allPrefixed ? { from: line.from, to: markerEnd } : { from: line.from, to: markerEnd, insert: prefix };
  });

  // Mapping rightward keeps the caret after an inserted prefix.
  const changeSet = state.changes(changes);
  view.dispatch({ changes: changeSet, selection: state.selection.map(changeSet, 1) });
  view.focus();
}
