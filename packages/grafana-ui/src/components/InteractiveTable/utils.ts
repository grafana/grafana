import { Column as RTColumn } from 'react-table';

import { EmptyExpanderHeader, ExpanderCell, ExpanderHeader } from './Expander';
import { Column } from './types';

export const EXPANDER_CELL_ID = '__expander' as const;

type InternalColumn<T extends object> = RTColumn<T> & {
  visible?: (data: T[]) => boolean;
};

function getColumnWidth<K extends object>(column: Column<K>): number | string | undefined {
  // If explicit width is provided, use it
  if (column.width !== undefined) {
    return column.width;
  }
  // disableGrow sets width to 0, which triggers the disableGrow CSS class
  if (column.disableGrow) {
    return 0;
  }
  return undefined;
}

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
      width: getColumnWidth(column),
      visible: column.visible,
      ...(column.sortDescFirst !== undefined && { sortDescFirst: column.sortDescFirst }),
      ...(column.cell && { Cell: column.cell }),
    })),
  ];
}
