import { type ChangeSpec, type EditorState, type Line } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { type RefObject } from 'react';

/** The lazily-loaded CodeMirror bundle does not expose its `EditorView`, so it comes from the DOM. */
export function getEditorView(container: RefObject<HTMLElement | null>) {
  return container.current ? EditorView.findFromDOM(container.current) : null;
}

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

/** The range a line's existing marker occupies, empty when it has none. */
function markerRange(line: Line) {
  return { from: line.from, to: line.from + (matchMarker(line.text)?.length ?? 0) };
}

function selectedLines(state: EditorState) {
  const { from, to, empty } = state.selection.main;
  // A selection ending exactly at a line start (Shift+Down, or dragging through a
  // trailing newline) does not touch that line, so it must not be prefixed.
  const end = !empty && to === state.doc.lineAt(to).from ? to - 1 : to;

  const lines = [];
  for (let n = state.doc.lineAt(from).number; n <= state.doc.lineAt(end).number; n++) {
    lines.push(state.doc.line(n));
  }
  return lines;
}

function applyLineChanges(view: EditorView, changes: ChangeSpec[]) {
  const { state } = view;
  // Mapping rightward keeps the caret after an inserted prefix.
  const changeSet = state.changes(changes);
  view.dispatch({ changes: changeSet, selection: state.selection.map(changeSet, 1) });
  view.focus();
}

/** Prefixes every line the selection touches, replacing any other marker or clearing its own. */
export function toggleLinePrefix(view: EditorView, prefix: string) {
  const lines = selectedLines(view.state);
  const target = matchMarker(prefix);

  // A partially prefixed selection is completed, not half-cleared.
  const allPrefixed = target !== undefined && lines.every((line) => matchMarker(line.text)?.kind === target.kind);

  applyLineChanges(
    view,
    lines.map((line) => (allPrefixed ? markerRange(line) : { ...markerRange(line), insert: prefix }))
  );
}

/**
 * Numbers every line the selection touches, or clears them when all are already numbered.
 *
 * Items adjoining the selection are renumbered too: `marked` takes a list's start from its
 * first item and counts up on its own, so only a sequential run reads the way it renders.
 */
export function toggleOrderedList(view: EditorView) {
  const { state } = view;
  const { doc } = state;
  const lines = selectedLines(state);
  const isNumbered = (text: string) => matchMarker(text)?.kind === 'numbered';

  if (lines.every((line) => isNumbered(line.text))) {
    applyLineChanges(view, lines.map(markerRange));
    return;
  }

  // The list the selection joins reaches through the numbered lines on either side of it.
  let runStart = lines[0].number;
  while (runStart > 1 && isNumbered(doc.line(runStart - 1).text)) {
    runStart--;
  }
  let runEnd = lines[lines.length - 1].number;
  while (runEnd < doc.lines && isNumbered(doc.line(runEnd + 1).text)) {
    runEnd++;
  }

  // An item already above the selection owns the list's start; otherwise it restarts at 1.
  const start = runStart < lines[0].number ? parseInt(doc.line(runStart).text, 10) : 1;

  const changes: ChangeSpec[] = [];
  for (let n = runStart; n <= runEnd; n++) {
    const range = markerRange(doc.line(n));
    const insert = `${start + n - runStart}. `;
    if (state.sliceDoc(range.from, range.to) !== insert) {
      changes.push({ ...range, insert });
    }
  }
  applyLineChanges(view, changes);
}
