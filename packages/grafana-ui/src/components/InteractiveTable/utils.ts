import { css } from '@emotion/css';
import { type CellContext, type ColumnDef, type Row } from '@tanstack/react-table';

import { EmptyExpanderHeader, ExpanderCell, ExpanderHeader } from './Expander';
import { type CellProps, type Column, type CompatRow } from './types';

export const EXPANDER_CELL_ID = '__expander' as const;

export type InternalColumn<T extends object> = ColumnDef<T> & {
  id: string;
  visible?: (data: T[]) => boolean;
  widthClass?: string;
};

function toCompatRow<T extends object>(row: Row<T>): CompatRow<T> {
  return Object.assign(row, {
    values: Object.fromEntries(row.getAllCells().map((cell) => [cell.column.id, cell.getValue()])),
  });
}

function toCellProps<T extends object, Value>(
  context: CellContext<T, Value> & { __rowID?: string }
): CellProps<T, Value> {
  const value = context.getValue();
  return {
    ...context,
    cell: Object.assign(context.cell, { value }),
    row: toCompatRow(context.row),
    value,
    __rowID: context.__rowID,
  };
}

export function getColumns<K extends object>(
  columns: Array<Column<K>>,
  showExpandAll = false
): Array<InternalColumn<K>> {
  return [
    {
      id: EXPANDER_CELL_ID,
      cell: (context) => ExpanderCell(toCellProps({ ...context })),
      header: showExpandAll ? ExpanderHeader : EmptyExpanderHeader,
      enableSorting: false,
      size: 0,
    },
    ...columns.map((column) => ({
      id: column.id,
      accessorFn: (row: K) => row[column.id as keyof K],
      header: column.header || (() => null),
      sortingFn:
        typeof column.sortType === 'function'
          ? (rowA: Row<K>, rowB: Row<K>, columnId: string) =>
              column.sortType!(toCompatRow(rowA), toCompatRow(rowB), columnId)
          : column.sortType === 'string'
            ? {
                string: 'text',
                number: 'basic',
                datetime: 'datetime',
                basic: 'basic',
                alphanumeric: 'alphanumeric',
              }[column.sortType]
            : 'alphanumeric',
      enableSorting: Boolean(column.sortType),
      size: column.width ?? (column.disableGrow ? 0 : undefined),
      minSize: column.minWidth,
      maxSize: column.maxWidth,
      widthClass: css({
        width: typeof column.width === 'number' && column.width > 0 ? column.width : undefined,
        minWidth: typeof column.minWidth === 'number' && column.minWidth > 0 ? column.minWidth : undefined,
        maxWidth: typeof column.maxWidth === 'number' && column.maxWidth > 0 ? column.maxWidth : undefined,
      }),
      visible: column.visible,
      ...(column.sortDescFirst !== undefined && { sortDescFirst: column.sortDescFirst }),
      ...(column.cell && {
        cell: (context: CellContext<K, unknown> & { __rowID?: string }) => column.cell!(toCellProps(context)),
      }),
    })),
  ];
}
