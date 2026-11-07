import { css } from '@emotion/css';

import { FieldType, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { CELL_HORIZONTAL_CHROME, FIRST_COLUMN_EXTRA_PADDING } from '../constants';
import { type TableColumn, type TableRow } from '../types';

// Distinct from user-facing field names; only used in react-data-grid, not in DataFrame.
export const ROW_NUMBER_COLUMN_KEY = '__grafana_row_number_gutter__';
export const ROW_NUMBER_GUTTER_CLASS = 'grafana-row-number-gutter';

/**
 * The gutter occupies space *inside* the existing table viewport. Size it for the
 * largest displayed position, not just the currently visible virtualized rows.
 * The font metric comes from the same monospace canvas measurement as JSON cells.
 */
export function getRowNumberGutterWidth(
  rowCount: number,
  monoCharWidth: number,
  minWidth: number,
  separatorSpacing: number,
  noPanelPadding = false
): number {
  const digits = String(Math.max(1, rowCount)).length;
  const textWidth = digits * monoCharWidth;
  const inset = noPanelPadding ? FIRST_COLUMN_EXTRA_PADDING : 0;
  // Four extra pixels keep the last digit clear of the right-hand separator.
  return Math.max(minWidth, Math.ceil(textWidth + CELL_HORIZONTAL_CHROME + inset + separatorSpacing));
}

/** The 1-based position in the sorted and filtered table (not the source row ID). */
export function getDisplayedRowNumber(pageRangeStart: number, rowIdx: number): number {
  return pageRangeStart + rowIdx;
}

/**
 * Map source parent indexes to their 1-based displayed positions. Placeholder rows
 * for expanded nested grids have depth 1 and must never consume a row number.
 */
export function getDisplayedParentRowNumbers(rows: readonly TableRow[], pageRangeStart = 1): Map<number, number> {
  const positions = new Map<number, number>();
  let position = pageRangeStart;
  for (const row of rows) {
    if (row.__depth === 0) {
      positions.set(row.__index, position++);
    }
  }
  return positions;
}

const getStyles = (theme: GrafanaTheme2) => ({
  number: css({
    width: '100%',
    textAlign: 'right',
    fontFamily: 'monospace',
    fontVariantNumeric: 'tabular-nums',
    color: theme.colors.text.secondary,
  }),
});

function RowNumberHeader() {
  return <span className="sr-only">{t('grafana-ui.table.row-number', 'Row number')}</span>;
}

function RowNumberCell({ number }: { number: number | undefined }) {
  const styles = useStyles2(getStyles);

  return number === undefined ? null : <span className={styles.number}>{number}</span>;
}

/** A fixed, presentation-only column; no synthetic field is added to the source frame. */
export function createRowNumberColumn(
  pageRangeStart: number,
  width: number,
  getRowNumber: (row: TableRow, rowIdx: number) => number | undefined = (_row, rowIdx) =>
    getDisplayedRowNumber(pageRangeStart, rowIdx)
): TableColumn {
  return {
    key: ROW_NUMBER_COLUMN_KEY,
    name: t('grafana-ui.table.row-number-column', 'Row number'),
    field: { name: '', type: FieldType.other, config: {}, values: [] },
    frozen: true,
    sortable: false,
    resizable: false,
    draggable: false,
    width,
    minWidth: width,
    maxWidth: width,
    cellClass: ROW_NUMBER_GUTTER_CLASS,
    headerCellClass: ROW_NUMBER_GUTTER_CLASS,
    renderHeaderCell: () => <RowNumberHeader />,
    renderCell: ({ row, rowIdx }) => <RowNumberCell number={getRowNumber(row, rowIdx)} />,
    renderSummaryCell: () => null,
  };
}
