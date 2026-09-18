import { css } from '@emotion/css';
import {
  flexRender,
  type BuiltInSortingFn,
  type CellContext,
  type ColumnDef,
  type HeaderContext,
  type SortingFnOption,
} from '@tanstack/react-table';
import { get } from 'lodash';

import { EmptyExpanderHeader, ExpanderCell, ExpanderHeader } from './Expander';
import { type CellProps, type Column, type SortType } from './types';

export const EXPANDER_CELL_ID = '__expander' as const;

export type InternalColumn<T extends object> = ColumnDef<T> & {
  id: string;
  visible?: (data: T[]) => boolean;
  widthClass?: string;
};

// react-table v7 sort types mapped onto the TanStack Table sorting functions
const SORTING_FNS: Record<SortType, BuiltInSortingFn> = {
  string: 'text',
  number: 'basic',
  datetime: 'datetime',
  basic: 'basic',
  alphanumeric: 'alphanumeric',
};

function toCellProps<T extends object, Value>(
  context: CellContext<T, Value> & { __rowID?: string }
): CellProps<T, Value> {
  const value = context.getValue();
  return {
    ...context,
    cell: { ...context.cell, value },
    value,
  };
}

function getSortingFn<K extends object>(column: Column<K>): SortingFnOption<K> {
  if (typeof column.sortType === 'function') {
    const sortType = column.sortType;
    return (rowA, rowB, columnId) => sortType(rowA, rowB, columnId);
  }

  return column.sortType ? SORTING_FNS[column.sortType] : 'alphanumeric';
}

export function getColumns<K extends object>(
  columns: Array<Column<K>>,
  showExpandAll = false
): Array<InternalColumn<K>> {
  return [
    {
      id: EXPANDER_CELL_ID,
      cell: (context) => ExpanderCell(toCellProps(context)),
      header: showExpandAll ? ExpanderHeader : EmptyExpanderHeader,
      enableSorting: false,
      size: 0,
    },
    ...columns.map((column) => ({
      id: column.id,
      accessorFn: (row: K) => get(row, column.id),
      // TanStack Table only accepts strings and render functions, so headers that are nodes or components are
      // wrapped in a function and rendered by flexRender
      header:
        typeof column.header === 'string'
          ? column.header
          : (context: HeaderContext<K, unknown>) => flexRender(column.header, context) ?? null,
      sortingFn: getSortingFn(column),
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
        // flexRender is used because cell renderers can be components (e.g. wrapped in `memo`) and not plain functions
        cell: (context: CellContext<K, unknown> & { __rowID?: string }) =>
          flexRender(column.cell, toCellProps(context)),
      }),
    })),
  ];
}
