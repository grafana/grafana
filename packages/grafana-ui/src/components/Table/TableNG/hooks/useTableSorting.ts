import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SortColumn, SortDirection } from 'react-data-grid';

import { DataFrame } from '@grafana/data';

import { ColumnTypes, TableRow, TableSortByActionCallback, TableSortByFieldState } from '../types';
import { getComparator, processNestedTableRows } from '../utils';

export type TableSortState = {
  sortColumns: readonly SortColumn[];
  nestedTableSortColumns: Record<number, readonly SortColumn[]>;
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

type UseTableSortingProps = {
  data: DataFrame;
  setRevId: React.Dispatch<React.SetStateAction<number>>;
  onSortByChange?: TableSortByActionCallback;
  initialSortBy?: TableSortByFieldState[];
  filteredRows: TableRow[];
  columnTypes: ColumnTypes;
  isNestedTable: boolean;
};

const handleTableSort = (
  columnKey: string,
  direction: SortDirection,
  isMultiSort: boolean,
  setSortColumns: React.Dispatch<React.SetStateAction<readonly SortColumn[]>>,
  sortColumnsRef: React.MutableRefObject<readonly SortColumn[]>
) => {
  let currentSortColumn: SortColumn | undefined;

  const updatedSortColumns = sortColumnsRef.current.filter((column) => {
    const isCurrentColumn = column.columnKey === columnKey;
    if (isCurrentColumn) {
      currentSortColumn = column;
    }
    return !isCurrentColumn;
  });

  // sorted column exists and is descending -> remove it to reset sorting
  if (currentSortColumn && currentSortColumn.direction === 'DESC') {
    setSortColumns(updatedSortColumns);
    sortColumnsRef.current = updatedSortColumns;
  } else {
    // new sort column or changed direction
    if (isMultiSort) {
      setSortColumns([...updatedSortColumns, { columnKey, direction }]);
      sortColumnsRef.current = [...updatedSortColumns, { columnKey, direction }];
    } else {
      setSortColumns([{ columnKey, direction }]);
      sortColumnsRef.current = [{ columnKey, direction }];
    }
  }
};

export const useTableSorting = ({
  data,
  setRevId,
  onSortByChange,
  initialSortBy,
  filteredRows,
  columnTypes,
  isNestedTable,
}: UseTableSortingProps): TableSortingTypes => {
  const initialSortColumns = useMemo<SortColumn[]>(() => {
    const initialSort = initialSortBy?.map(({ displayName, desc }) => {
      const matchingField = data.fields.find(({ state }) => state?.displayName === displayName);
      const columnKey = matchingField?.name || displayName;

      return {
        columnKey,
        direction: desc ? ('DESC' as const) : ('ASC' as const),
      };
    });
    return initialSort ?? [];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // TODO: This ref persists sortColumns between renders. setSortColumns is still used to trigger re-render
  const sortColumnsRef = useRef<SortColumn[]>(initialSortColumns);
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>(initialSortColumns);
  const [nestedTableSortColumns, setNestedTableSortColumns] = useState<Record<number, readonly SortColumn[]>>({});

  // Reset sortColumns when initialSortBy changes
  useEffect(() => {
    if (initialSortColumns.length > 0) {
      setSortColumns(initialSortColumns);
    }
  }, [initialSortColumns, setSortColumns]);

  const handleNestedTableSort = useCallback(
    (parentRowIdx: number, newSortColumns: readonly SortColumn[]) => {
      setNestedTableSortColumns((prev: Record<number, readonly SortColumn[]>) => ({
        ...prev,
        [parentRowIdx]: newSortColumns,
      }));
      // Force re-render when nested table sorting changes
      setRevId((prev: number) => prev + 1);
    },
    [setNestedTableSortColumns, setRevId]
  );

  const onSort = useCallback(
    (...[columnKey, direction, isMultiSort, parentRowIdx, hasNestedFrames]: SortHandlerParams) => {
      if (hasNestedFrames && parentRowIdx !== undefined) {
        // For nested tables, use the nested table sort handler
        handleNestedTableSort(parentRowIdx, [{ columnKey, direction }]);
      } else {
        // For the main table, use the standard sort handler
        handleTableSort(columnKey, direction, isMultiSort, setSortColumns, sortColumnsRef);

        // Update panel context with the new sort order
        if (onSortByChange) {
          const sortByFields = sortColumnsRef.current.map(({ columnKey, direction }) => ({
            displayName: columnKey,
            desc: direction === 'DESC',
          }));
          onSortByChange(sortByFields);
        }
      }
    },
    [handleNestedTableSort, setSortColumns, sortColumnsRef, onSortByChange]
  );

  // Sort rows
  const sortedRows = useMemo(() => {
    if (sortColumns.length === 0) {
      return filteredRows;
    }

    // Common sort comparator function
    const compareRows = (a: TableRow, b: TableRow): number => {
      let result = 0;
      for (let i = 0; i < sortColumns.length; i++) {
        const { columnKey, direction } = sortColumns[i];
        const compare = getComparator(columnTypes[columnKey]);
        const sortDir = direction === 'ASC' ? 1 : -1;

        result = sortDir * compare(a[columnKey], b[columnKey]);
        if (result !== 0) {
          break;
        }
      }
      return result;
    };

    // Handle nested tables
    if (isNestedTable) {
      return processNestedTableRows(filteredRows, (parents) => [...parents].sort(compareRows));
    }

    // Regular sort for tables without nesting
    return filteredRows.slice().sort((a, b) => compareRows(a, b));
  }, [filteredRows, sortColumns, columnTypes, isNestedTable]);

  return {
    handleNestedTableSort,
    onSort,
    nestedTableSortColumns,
    sortColumns,
    sortedRows,
  };
};
