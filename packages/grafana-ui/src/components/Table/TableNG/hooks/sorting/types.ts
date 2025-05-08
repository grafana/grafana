import { SortColumn, SortDirection } from 'react-data-grid';

import { DataFrame } from '@grafana/data';

import { ColumnTypes, TableRow, TableSortByActionCallback, TableSortByFieldState } from '../../types';

export type TableSortState = {
  nestedTableSortColumns: Record<number, readonly SortColumn[]>;
  sortColumns: readonly SortColumn[];
  sortedRows: TableRow[];
};

export type SortHandlerParams = [
  columnKey: string,
  direction: SortDirection,
  isMultiSort: boolean,
  parentRowIdx?: number,
  hasNestedFrames?: boolean,
];

export type TableSortHandlers = {
  handleNestedTableSort: (parentRowIdx: number, newSortColumns: readonly SortColumn[]) => void;
  onSort: (...args: SortHandlerParams) => void;
};

export type TableSortingTypes = TableSortState & TableSortHandlers;

export type UseTableSortingProps = {
  columnTypes: ColumnTypes;
  data: DataFrame;
  filteredRows: TableRow[];
  initialSortBy?: TableSortByFieldState[];
  isNestedTable: boolean;
  onSortByChange?: TableSortByActionCallback;
  setRevId: React.Dispatch<React.SetStateAction<number>>;
};
