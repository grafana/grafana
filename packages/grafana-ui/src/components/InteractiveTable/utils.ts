import { css } from '@emotion/css';
import { type Column as RTColumn } from 'react-table';

import { EmptyExpanderHeader, ExpanderCell, ExpanderHeader } from './Expander';
import { type Column } from './types';

export const EXPANDER_CELL_ID = '__expander' as const;

type InternalColumn<T extends object> = RTColumn<T> & {
  visible?: (data: T[]) => boolean;
};

// Returns the columns in a "react-table" acceptable format
export function getColumns<K extends object>(
  columns: Array<Column<K>>,
  showExpandAll = false
): Array<InternalColumn<K>> {
  return [
    {
      id: EXPANDER_CELL_ID,
      Cell: ExpanderCell,
      Header: showExpandAll ? ExpanderHeader : EmptyExpanderHeader,
      disableSortBy: true,
      width: 0,
    },
    // @ts-expect-error react-table expects each column key(id) to have data associated with it and therefore complains about
    // column.id being possibly undefined and not keyof T (where T is the data object)
    // We do not want to be that strict as we simply pass undefined to cells that do not have data associated with them.
    ...columns.map((column) => ({
      id: column.id,
      accessor: column.id,
      Header: column.header || (() => null),
      sortType: column.sortType || 'alphanumeric',
      disableSortBy: !Boolean(column.sortType),
      width: column.width ?? (column.disableGrow ? 0 : undefined),
      minWidth: column.minWidth,
      maxWidth: column.maxWidth,
      widthClass: css({
        width: typeof column.width === 'number' && column.width > 0 ? column.width : undefined,
        minWidth: typeof column.minWidth === 'number' && column.minWidth > 0 ? column.minWidth : undefined,
        maxWidth: typeof column.maxWidth === 'number' && column.maxWidth > 0 ? column.maxWidth : undefined,
      }),
      visible: column.visible,
      ...(column.sortDescFirst !== undefined && { sortDescFirst: column.sortDescFirst }),
      ...(column.cell && { Cell: column.cell }),
    })),
  ];
}
