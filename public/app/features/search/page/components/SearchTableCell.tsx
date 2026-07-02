import { type Cell } from 'react-table';

import { type DataFrame } from '@grafana/data';

import { type TableColumn } from './SearchResultsTable';

interface Props {
  cell: Cell;
  userProps?: object;
  frame: DataFrame;
}

/**
 * Renders a single react-table cell for the search results table. This was previously the shared
 * grafana-ui `TableCell` (from the legacy react-table Table); search only needs the thin
 * `cell.render('Cell', ...)` invocation plus the cell-prop style tweaks, so it lives here now that
 * the legacy table is being removed. Each search column supplies its own `Cell` renderer (see
 * columns.tsx), consuming `cellProps`, `userProps` and `row.index`.
 */
export const SearchTableCell = ({ cell, userProps, frame }: Props) => {
  const cellProps = cell.getCellProps();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const field = (cell.column as unknown as TableColumn).field;

  if (!field?.display) {
    return null;
  }

  if (cellProps.style) {
    cellProps.style.wordBreak = 'break-word';
    cellProps.style.minWidth = cellProps.style.width;
  }

  return <>{cell.render('Cell', { field, cellProps, userProps, frame })}</>;
};
