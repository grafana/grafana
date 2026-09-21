import { Global } from '@emotion/react';

import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { useTheme2 } from '@grafana/ui';

import { NOTEBOOK_DOCUMENT_CLASS } from './layout-notebook/NotebookLayoutManager';
import { NOTEBOOK_CELL_CONTENT_CLASS } from './layout-notebook/edit/NotebookCellFrame';

// A4 portrait. In millimetres because the target is a physical sheet, which keeps the sizing honest
// instead of routing it through a dpi assumption. The inset is applied as the document's own padding
// rather than a page margin — see the `@page` rule below for why a real page margin is not usable.
export const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;
const PDF_PAGE_MARGIN_MM = 12;
/**
 * Leading space on each cell, which doubles as the top inset for whichever cell a page break
 * happens to land in front of. Leading only, not symmetric: between two cells the gap is one
 * cell's worth rather than two, which keeps the document's rhythm tight while still giving a cell
 * that begins a page something to stand off from.
 */
const PDF_CELL_INSET_MM = 4;

/**
 * Page geometry for a notebook being captured as a PDF. Rendered only by NotebookRenderPage, which
 * is the sole route that wants it — there is no flag to check here, because being mounted at all is
 * the signal.
 *
 * Global rather than scoped because most of what has to change is above this component in the tree:
 * `html`/`body` are the document itself, and `@page` is an at-rule with no element to attach to. The
 * two `.notebook-*` rules below are descendants and could be scoped; they are here so the whole page
 * geometry reads in one place.
 *
 * No `!important` anywhere, unlike when this ran on the normal notebook route: the render route
 * mounts no Page shell and no toolbar, so these are the page's own styles rather than overrides
 * fighting screen styling that outranks them.
 */
export function NotebookPdfLayout() {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const theme = useTheme2();

  return (
    <Global
      styles={{
        // A plain `@media print` rule is not enough: the renderer captures the page as it already
        // sits, not through a print-emulated pass, so the document's actual width has to shrink for
        // real. Sized on `html`/`body` because that is what the renderer measures — constraining
        // something further in leaves the document as wide as it ever was.
        //
        // The inset is padding rather than an `@page` margin because Chromium paints nothing into a
        // page's margin area and does not support a background there: a margin would leave a
        // bare-paper band around a document whose own canvas is deliberately not white. Padding
        // keeps the canvas edge to edge, so the notebook's grey still does the job it does on
        // screen — giving the white panels something to sit on.
        //
        // Left and right insets repeat on every page (they belong to a block that spans all of
        // them); top and bottom apply once, at the start and end of the flow.
        //
        // The padding comes out of this width rather than adding to it, because @grafana/ui's base
        // styles already put `box-sizing: border-box` on `html` and have everything inherit it
        // (GlobalStyles/elements.ts).
        'html, body': {
          maxWidth: `${PDF_PAGE_WIDTH_MM}mm`,
          margin: '0 auto',
          padding: `${PDF_PAGE_MARGIN_MM}mm`,
          background: visualRefreshEnabled ? theme.colors.background.page : theme.colors.background.canvas,
        },
        // The body's padding above insets the top of page one and the bottom of the last page, but
        // not the pages in between — a block's vertical padding is spent at the start and end of its
        // whole flow, not per fragment. Padding on the cells covers the gap: unlike a margin, which
        // fragmentation drops at a break, padding on a box that begins a page is drawn there, so
        // whichever cell follows a break gets its own inset.
        [`.${NOTEBOOK_CELL_CONTENT_CLASS}`]: {
          paddingTop: `${PDF_CELL_INSET_MM}mm`,
        },
        // The column's own inset, dropped on every side so the page padding above is the single
        // thing holding the document off the paper. Its reading-width padding exists to stop prose
        // running the full width of a wide screen, which the page width already does here — left in
        // place the two stack, costing ~110px of a 794px sheet across.
        [`.${NOTEBOOK_DOCUMENT_CLASS}`]: {
          maxWidth: 'none',
          padding: 0,
        },
        // The actual lever a headless-Chrome PDF engine consults for physical page shape, per the
        // CSS Paged Media spec. Margin stays zero: the inset lives in the body's padding above
        // instead, so the notebook's canvas colour reaches the paper's edge rather than stopping
        // short of it.
        '@page': {
          size: `${PDF_PAGE_WIDTH_MM}mm ${PDF_PAGE_HEIGHT_MM}mm`,
          margin: 0,
        },
      }}
    />
  );
}
