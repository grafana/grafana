import { EditorSelection, type Extension } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';
import { useMemo, useRef } from 'react';

/**
 * An extension that puts the caret in the editor.
 *
 * CodeMirrorEditor exposes no ref, no autoFocus and no onCreateEditor, so a view plugin is the only
 * hook into an editor that arrives with a lazily loaded chunk — it runs whenever CodeMirror builds
 * the view, however many frames later that is.
 *
 * The focus is deferred a frame for two reasons, both races it would otherwise lose: a plugin is
 * constructed before the view's DOM is appended to its parent, and focusing a detached node does
 * nothing; and the controls that ask for this — the add-block menu, the language picker — hand focus
 * back to themselves as they close, which floating-ui does in a microtask.
 *
 * A fresh plugin per request, because CodeMirror rebuilds its plugins exactly when the extensions
 * array stops being shallow-equal. That makes a new one the way to ask for the caret again.
 *
 * Also moves the selection to the end of the document, not just the focus: `CodeMirrorEditor` never
 * passes an initial `selection`, so a freshly created view otherwise defaults to position 0 — fine for
 * every caller that seeds empty content, but wrong the moment a cell arrives with text already in it
 * (e.g. a list continuation's `"- "` marker, or a heading's `"# "`), where position 0 sits *before*
 * that text instead of ready to continue it.
 */
export function buildFocusExtension() {
  return [
    ViewPlugin.define((view) => {
      requestAnimationFrame(() => {
        view.focus();
        view.dispatch({ selection: EditorSelection.cursor(view.state.doc.length) });
      });
      return {};
    }),
  ];
}

/**
 * Builds a focus extension exactly when this cell should take the caret — once at mount if it's
 * already the reader's target, and again on demand afterward. Shared by CodeCell and MarkdownCell,
 * the two cell types that mount a CodeMirror editor and can be asked for focus more than once in
 * their lifetime.
 *
 * `focusRequestId` is a nonce, not a boolean, because a focus *request* can retarget a cell that is
 * already the target — e.g. converting a markdown cell in place via its own "/" menu (Paragraph,
 * Heading — both stay "Markdown", same cell, same key) never flips `autoFocus` from false to true,
 * yet the click that opened the menu just moved DOM focus away from it. A plain boolean has no way to
 * signal "again"; a value that changes on every request does. Each caller is free to source its own
 * nonce — CodeCell keeps an internal counter it bumps itself, while MarkdownCell is handed one from
 * outside (see NotebookLayoutManager's own `focusRequest` state) — this hook only cares that the value
 * changes when a fresh request arrives.
 *
 * `pendingAutoFocus` is a one-shot, mount-time-only check: it captures `autoFocus && isEditing` at
 * this hook's own first render (autoFocus is only ever true for a cell just inserted or just made the
 * target, and insertion only happens while already editing, so that first render already carries the
 * final values) and never reconsiders it — later remounts of the editor (e.g. MarkdownCell's own
 * unmount/remount on every `isEditing` toggle) start a fresh call to this hook and get their own fresh
 * one-shot, so a cell that already had its turn doesn't get autofocus back just for re-entering edit
 * mode.
 */
export function useFocusExtension({
  autoFocus,
  isEditing,
  focusRequestId,
}: {
  autoFocus?: boolean;
  isEditing: boolean;
  focusRequestId?: number;
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
      return buildFocusExtension();
    }

    const isFreshRequest = focusRequestId !== undefined && focusRequestId !== previousFocusRequestId.current;
    previousFocusRequestId.current = focusRequestId;
    return isFreshRequest ? buildFocusExtension() : undefined;
  }, [isEditing, focusRequestId]);
}
