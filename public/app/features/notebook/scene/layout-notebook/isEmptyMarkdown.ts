import { type CellContentKind } from '../../types';

/**
 * Deliberately its own module, for the same kind of reason as `isNotebookLayoutManager`.
 *
 * APPLY_NOTEBOOK_SPEC needs this, and the mutation command registry it lives in is reachable from the
 * app entrypoint. Importing it from NotebookLayoutManager therefore pulled that component, the
 * drag-and-drop library and every cell editor into the main bundle, which CI rejects on size.
 *
 * Whether `content` is an untouched, empty markdown cell — the shape the trailing-slot invariant (see
 * setCellContent and the renderer's own bootstrap effect) watches for. `undefined` (a panel or
 * collapsed cell, which carries no `content` at all) deliberately does *not* count: it isn't a
 * typeable markdown slot either, so a panel ending up last must still get a fresh empty cell appended
 * after it, exactly like any other non-empty trailing content would.
 */
export function isEmptyMarkdown(content: CellContentKind | undefined): boolean {
  return content?.kind === 'Markdown' && content.spec.text === '';
}
