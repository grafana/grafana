import { type CellContentKind } from '../../types';

/**
 * Two different questions about how full a cell's content is, which is why they are two functions:
 * isEmptyMarkdown (is this the untouched, typeable trailing slot?) and isDiscardableContent (would
 * deleting this lose anything?). They disagree on purpose — a heading holding only its `# ` marker is
 * content contentCells has to keep, or saving drops it, and nothing at all to the delete button.
 *
 * Kept out of NotebookLayoutManager because APPLY_NOTEBOOK_SPEC needs isEmptyMarkdown, and the command
 * registry it lives in is reachable from the app entrypoint: importing from there pulled the
 * drag-and-drop library and every cell editor into the main bundle, which CI rejects on size.
 */

/**
 * `undefined` deliberately does not count: a panel or collapsed cell is not a typeable slot either, so
 * one ending up last must still get a fresh empty cell appended after it.
 */
export function isEmptyMarkdown(content: CellContentKind | undefined): boolean {
  return content?.kind === 'Markdown' && content.spec.text === '';
}

/** Trailing whitespace only: four leading spaces make an indented code block, whose `-` is content. */
const UNFILLED_MARKDOWN_MARKER = /^(#{1,6}|>|[-*+]|\d+\.)[ \t]*$/;

/**
 * Whether deleting a cell holding this content would lose nothing, so it can skip the confirmation
 * modal — a block still sitting empty is exactly the one whose type turned out to be the wrong pick.
 *
 * A panel cell carries no `content` at all and so is never discardable: deleting a visualization
 * always asks. Panel emptiness cannot be read off the queries, because every viz type but the
 * notebook's own keeps content somewhere else — a Canvas panel's elements, a Text panel's markdown.
 */
export function isDiscardableContent(content: CellContentKind | undefined): boolean {
  switch (content?.kind) {
    case 'Markdown': {
      const { text } = content.spec;
      return text.trim() === '' || UNFILLED_MARKDOWN_MARKER.test(text);
    }
    case 'Code':
      // `annotation` is persisted content no editor authors yet but an assistant can; `highlight` is
      // line numbers, which mean nothing with no code left to point at.
      return content.spec.code.trim() === '' && !content.spec.annotation;
    default:
      return false;
  }
}
