import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Cell, type Column } from '@grafana/react-data-grid';

import { useStyles2 } from '../../../themes/ThemeContext';

import { TABLE } from './constants';
import { type FromFieldsResult, type TableNGProps, type TableRow, type TableSummaryRow } from './types';

export const ROW_NUMBER_KEY = '__grafana_row_number__';
export type GridColumns = FromFieldsResult<Column<TableRow, TableSummaryRow>>;

export function useRowNumbers({ rowNumbersEnabled = false, showRowNumbers = false }: TableNGProps) {
  const [visible, setVisible] = useState(showRowNumbers);
  const [previousDefault, setPreviousDefault] = useState(showRowNumbers);
  if (previousDefault !== showRowNumbers) {
    setPreviousDefault(showRowNumbers);
    setVisible(showRowNumbers);
  }
  const className = useStyles2(getStyles);
  return { available: rowNumbersEnabled, visible: rowNumbersEnabled && visible, setVisible, className };
}

export const getRowNumberWidth = (count: number, monoCharWidth: number, inset = 0) =>
  Math.ceil(String(Math.max(count, 1)).length * monoCharWidth) + TABLE.CELL_PADDING * 2 + 1 + inset;

export function withRowNumbers(result: GridColumns, rows: TableRow[], width: number, className: string): GridColumns {
  if (!width) {
    return result;
  }
  // Use displayed parent positions, independently of source indexes, pagination, and expansion placeholders.
  const positions = new Map(rows.filter((row) => row.__depth === 0).map((row, index) => [row, index + 1]));
  const column: Column<TableRow, TableSummaryRow> = {
    key: ROW_NUMBER_KEY,
    name: t('grafana-ui.table.row-numbers', 'Row numbers'),
    width,
    minWidth: width,
    maxWidth: width,
    frozen: true,
    sortable: false,
    resizable: false,
    draggable: false,
    cellClass: className,
    headerCellClass: className,
    summaryCellClass: className,
    renderCell: ({ row }) => positions.get(row),
    renderHeaderCell: ({ column }) => <span className="sr-only">{column.name}</span>,
    renderSummaryCell: () => null,
  };
  return {
    columns: [column, ...result.columns],
    cellRootRenderers: { ...result.cellRootRenderers, [ROW_NUMBER_KEY]: (key, props) => <Cell key={key} {...props} /> },
  };
}

const getStyles = (theme: GrafanaTheme2) =>
  css({
    '&&': {
      fontFamily: 'monospace',
      textAlign: 'right',
      color: theme.colors.text.secondary,
      backgroundColor: theme.colors.background.secondary,
      borderInlineEnd: `1px solid ${theme.colors.border.weak}`,
    },
  });
