import { uniqueId } from 'lodash';
import { Column as RTColumn } from 'react-table';

import { ExpanderCell } from './ExpanderCell';

import { Column } from '.';

export const EXPANDER_CELL_ID = '__expander';

type InternalColumn<T extends object> = RTColumn<T> & {
  visible?: (data: T[]) => boolean;
};

// Returns the columns in a "react-table" acceptable format
export function getColumns<K extends object>(columns: Array<Column<K>>): Array<InternalColumn<K>> {
  return [
    {
      id: EXPANDER_CELL_ID,
      Cell: ExpanderCell,
      disableSortBy: true,
      width: 0,
    },
    // @ts-expect-error react-table expects each column key(id) to have data associated with it and therefore complains about
    // column.id being possibly undefined and not keyof T (where T is the data object)
    // We do not want to be that strict as we simply pass undefined to cells that do not have data associated with them.
    ...columns.map((column) => ({
      Header: column.header || (() => null),
      accessor: column.id || uniqueId(),
      sortType: column.sortType || 'alphanumeric',
      disableSortBy: !Boolean(column.sortType),
      width: column.shrink ? 0 : undefined,
      visible: column.visible,
      ...(column.cell && { Cell: column.cell }),
    })),
  ];
}
