import { EditorSelection, type Extension } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';
import { useMemo, useRef } from 'react';

/**
 * An extension that puts the caret in the editor. Deferred a frame because a plugin is constructed
 * before its view is attached to the DOM (focusing a detached node does nothing), and because things
 * like the block-type menu hand focus back as they close, in a microtask.
 *
 * A fresh call is how a caller asks for the caret again — CodeMirror rebuilds its plugins whenever the
 * `extensions` array identity changes.
 *
 * `moveToEnd` optionally also moves the selection to the end of the document: a freshly created view
 * otherwise defaults to position 0, which sits before any text a cell already arrives with (a list
 * marker, a heading's "# ") instead of ready to continue it. Not always wanted, though — a request
 * that merely restores focus to a cell whose own content didn't change (CodeCell's language picker)
 * should leave the reader's caret exactly where they left it, not jump it to the end.
 */
function buildFocusExtension(moveToEnd: boolean) {
  return [
    ViewPlugin.define((view) => {
      requestAnimationFrame(() => {
        view.focus();
        if (moveToEnd) {
          view.dispatch({ selection: EditorSelection.cursor(view.state.doc.length) });
        }
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
 * remounting (MarkdownCell remounts its editor on every `isEditing` toggle). That initial mount
 * always moves the caret to the end (a cell only auto-focuses at mount when it's new, or was just
 * seeded with starter content it should continue from) — `moveToEndOnRefocus` covers the *other*
 * kind of request, a repeat one after mount, where that's not always true. MarkdownCell converting a
 * cell in place still seeds new content (defaults to `true`); CodeCell's language picker doesn't
 * touch the cell's own code at all, so it passes `false` to leave the reader's caret alone.
 */
export function useFocusExtension({
  autoFocus,
  isEditing,
  focusRequestId,
  moveToEndOnRefocus = true,
}: {
  autoFocus?: boolean;
  isEditing: boolean;
  focusRequestId?: number;
  moveToEndOnRefocus?: boolean;
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
      return buildFocusExtension(true);
    }

    const isFreshRequest = focusRequestId !== undefined && focusRequestId !== previousFocusRequestId.current;
    previousFocusRequestId.current = focusRequestId;
    return isFreshRequest ? buildFocusExtension(moveToEndOnRefocus) : undefined;
  }, [isEditing, focusRequestId, moveToEndOnRefocus]);
}
