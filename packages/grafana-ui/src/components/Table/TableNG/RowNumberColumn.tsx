import { css } from '@emotion/css';

import { FieldType, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { type TableColumn } from './types';

// Distinct from user-facing field names; only used in react-data-grid, not in DataFrame.
export const ROW_NUMBER_COLUMN_KEY = '__grafana_row_number_gutter__';

// Initial compact width. Layout-aware sizing at digit boundaries follows in commit 3.
const ROW_NUMBER_WIDTH = 50;

/** The 1-based position in the sorted and filtered table (not the source row ID). */
export function getDisplayedRowNumber(pageRangeStart: number, rowIdx: number): number {
  return pageRangeStart + rowIdx;
}

/** A fixed, presentation-only column; no synthetic field is added to the source frame. */
export function createRowNumberColumn(pageRangeStart: number, theme: GrafanaTheme2): TableColumn {
  const numberClass = css({
    width: '100%',
    textAlign: 'right',
    fontFamily: 'monospace',
    fontVariantNumeric: 'tabular-nums',
    color: theme.colors.text.secondary,
  });
  const gutterClass = css({
    backgroundColor: theme.colors.background.secondary,
    borderInlineEnd: `1px solid ${theme.components.table.border}`,
  });

  return {
    key: ROW_NUMBER_COLUMN_KEY,
    name: t('grafana-ui.table.row-number-column', 'Row number'),
    // This metadata only satisfies TableColumn typing; it is never inserted into DataFrame.fields.
    field: { name: '', type: FieldType.other, config: {}, values: [] },
    frozen: true,
    sortable: false,
    resizable: false,
    draggable: false,
    width: ROW_NUMBER_WIDTH,
    minWidth: ROW_NUMBER_WIDTH,
    maxWidth: ROW_NUMBER_WIDTH,
    cellClass: gutterClass,
    headerCellClass: gutterClass,
    renderHeaderCell: () => (
      <span className={numberClass} title={t('grafana-ui.table.row-number', 'Row number')}>
        #
      </span>
    ),
    renderCell: ({ rowIdx }) => <span className={numberClass}>{getDisplayedRowNumber(pageRangeStart, rowIdx)}</span>,
  };
}
