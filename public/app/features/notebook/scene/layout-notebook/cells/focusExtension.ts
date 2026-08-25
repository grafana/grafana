import { EditorSelection, Prec, type Extension } from '@codemirror/state';
import { keymap, ViewPlugin, type EditorView } from '@codemirror/view';
import { useMemo, useRef } from 'react';

/**
 * Where a focus grant should leave the caret: a specific document position, `'preserve'` to leave the
 * current selection untouched (CodeCell's language picker — the code itself didn't change, so there's
 * nothing to reposition for), or omitted entirely for the common case, the end of the document.
 */
type CaretOnFocus = number | 'preserve';

/**
 * An extension that puts the caret in the editor. Deferred a frame because a plugin is constructed
 * before its view is attached to the DOM (focusing a detached node does nothing), and because things
 * like the block-type menu hand focus back as they close, in a microtask.
 *
 * A fresh call is how a caller asks for the caret again — CodeMirror rebuilds its plugins whenever the
 * `extensions` array identity changes.
 */
function buildFocusExtension(caretOnFocus: CaretOnFocus | undefined) {
  return [
    ViewPlugin.define((view) => {
      requestAnimationFrame(() => {
        view.focus();
        if (caretOnFocus === 'preserve') {
          return;
        }
        view.dispatch({ selection: EditorSelection.cursor(caretOnFocus ?? view.state.doc.length) });
      });
      return {};
    }),
  ];
}

/**
 * Builds a focus extension when this cell should take the caret — once at mount if it's already the
 * target, and again whenever `focusRequestId` changes afterward. Shared by CodeCell and MarkdownCell.
 *
 * `focusRequestId` is a nonce rather than a boolean because a request can retarget a cell that's
 * already the target — e.g. picking "Paragraph" from a markdown cell's own "/" menu converts it in
 * place, so `autoFocus` never flips even though the click just moved DOM focus away. Each caller
 * supplies its own nonce: CodeCell bumps an internal counter, MarkdownCell gets one from the layout
 * manager (see its `focusRequest` state).
 *
 * `pendingAutoFocus` only fires once, at mount: it captures `autoFocus && isEditing` on first render
 * and never reconsiders it, so a cell that already had its turn doesn't get refocused just for
 * remounting (MarkdownCell remounts its editor on every `isEditing` toggle).
 *
 * `caretOnFocus` applies to both cases uniformly — the default (omitted, meaning "the document's own
 * end") suits a cell whose content is either brand new or was just replaced with short starter text
 * (a heading marker, an empty paragraph). Splitting a cell mid-sentence via Enter is the one case
 * where the new cell's content is *not* just starter text — the reader's own text carries over too —
 * so the caller passes the exact offset to land on instead (see NotebookLayoutManager's own onAdvance).
 * CodeCell's language picker passes `'preserve'`, the one case where nothing about the content changed
 * at all.
 */
export function useFocusExtension({
  autoFocus,
  isEditing,
  focusRequestId,
  caretOnFocus,
}: {
  autoFocus?: boolean;
  isEditing: boolean;
  focusRequestId?: number;
  caretOnFocus?: CaretOnFocus;
}): Extension[] | undefined {
  const pendingAutoFocus = useRef(autoFocus && isEditing);
  const previousFocusRequestId = useRef(focusRequestId);

  return useMemo(() => {
    if (!isEditing) {
      return undefined;
    }

    if (pendingAutoFocus.current) {
      pendingAutoFocus.current = false;
      previousFocusRequestId.current = focusRequestId;
      return buildFocusExtension(caretOnFocus);
    }

    const isFreshRequest = focusRequestId !== undefined && focusRequestId !== previousFocusRequestId.current;
    previousFocusRequestId.current = focusRequestId;
    return isFreshRequest ? buildFocusExtension(caretOnFocus) : undefined;
  }, [isEditing, focusRequestId, caretOnFocus]);
}

/**
 * An ArrowUp/ArrowDown keymap that only fires `onNavigate` once the caret has nowhere further to go
 * *inside this editor* — shared by CodeCell and MarkdownCell, the notebook's two caret-based cells.
 *
 * `view.moveVertically` is the same primitive CodeMirror's own `cursorLineUp`/`cursorLineDown`
 * commands use internally, so it already accounts for soft-wrapped lines: if moving vertically from
 * the current position doesn't actually move it, there is truly no line above/below to go to (not
 * just no more *logical* lines), and the notebook should hand off to the sibling cell instead of
 * leaving the key a no-op. A non-empty selection is left alone, matching how a real text editor
 * collapses a selection on an arrow key before doing anything else with it.
 */
export function navigationKeymap(onNavigate: (direction: 'up' | 'down') => void): Extension[] {
  const run = (forward: boolean) => (view: EditorView) => {
    const range = view.state.selection.main;
    if (!range.empty) {
      return false;
    }
    const moved = view.moveVertically(range, forward);
    if (moved.head !== range.head) {
      return false;
    }
    onNavigate(forward ? 'down' : 'up');
    return true;
  };

  // Prec.highest for the same reason MarkdownCell's own Enter/Shift-Enter keymap needs it — it must
  // win over basicSetup's bundled default ArrowUp/ArrowDown bindings.
  return [
    Prec.highest(
      keymap.of([
        { key: 'ArrowUp', run: run(false) },
        { key: 'ArrowDown', run: run(true) },
      ])
    ),
  ];
}
