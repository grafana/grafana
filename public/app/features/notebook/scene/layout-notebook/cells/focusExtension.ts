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
 * Also moves the selection to the end of the document: a freshly created view otherwise defaults to
 * position 0, which sits before any text a cell already arrives with (a list marker, a heading's "# ")
 * instead of ready to continue it.
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
