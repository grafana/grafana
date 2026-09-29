import { Global } from '@emotion/react';

import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { useTheme2 } from '@grafana/ui';

import { NOTEBOOK_DOCUMENT_CLASS } from './layout-notebook/NotebookLayoutManager';

// A4 portrait, in millimetres because the target is a physical sheet.
export const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;
/** The page inset: an `@page` margin vertically, padding on the document column horizontally. */
const PDF_PAGE_MARGIN_MM = 12;

/**
 * Page geometry for a notebook being captured as a PDF, mounted only by NotebookRenderPage. Global
 * because `html`/`body` sit above this component and `@page` has no element to attach to.
 */
export function NotebookPdfLayout() {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const theme = useTheme2();
  const background = visualRefreshEnabled ? theme.colors.background.page : theme.colors.background.canvas;

  return (
    <Global
      styles={{
        // Definite widths throughout, never `max-width`: Chromium sizes a print layout from the
        // content's intrinsic width, where a cap is not a floor. A notebook holding only a chart
        // shrank to the width of its own title, and the chart then overflowed and was clipped.
        'html, body': {
          width: `${PDF_PAGE_WIDTH_MM}mm`,
          margin: '0 auto',
          background,
        },
        // The horizontal inset, so the page area stays a full 210mm wide and the widths can match
        // it. Not on `html`/`body`: padding on both doubles it, and @grafana/ui's base styles pin
        // `body { padding-right: 0 !important }`, so only the left would have doubled.
        [`.${NOTEBOOK_DOCUMENT_CLASS}`]: {
          width: `${PDF_PAGE_WIDTH_MM}mm`,
          maxWidth: 'none',
          padding: `0 ${PDF_PAGE_MARGIN_MM}mm`,
        },
        // `margin` is the only inset a page break sees: a box's own vertical padding is spent once,
        // at the start and end of its whole flow, which leaves every break between them flush
        // against the paper. `background` is what makes that margin usable — the canvas background
        // above stops at the page area, so without it the margin prints as a bare-paper band and the
        // sheet comes out two colours. Set in both places so a renderer that ignores it here still
        // paints the document itself.
        '@page': {
          size: `${PDF_PAGE_WIDTH_MM}mm ${PDF_PAGE_HEIGHT_MM}mm`,
          margin: `${PDF_PAGE_MARGIN_MM}mm 0`,
          background,
        },
      }}
    />
  );
}
