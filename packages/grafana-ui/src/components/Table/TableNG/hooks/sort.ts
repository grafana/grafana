import { useEffect, useMemo, useState } from 'react';

import { type Field } from '@grafana/data';
import { type SortColumn } from '@grafana/react-data-grid';

import { type SortByBehavior, type TableRow, type TableSortByFieldState } from '../types';
import { getColumnTypes, getDisplayName } from '../utils/fields';
import { applySort } from '../utils/sort';

export interface SortedRowsOptions {
  hasNestedFrames?: boolean;
  initialSortBy?: TableSortByFieldState[];
}

export interface SortedRowsResult {
  rows: TableRow[];
  sortColumns: SortColumn[];
  setSortColumns: React.Dispatch<React.SetStateAction<SortColumn[]>>;
}

interface ManagedSortProps {
  sortByBehavior: SortByBehavior;
  setSortColumns: React.Dispatch<React.SetStateAction<SortColumn[]>>;
  sortBy?: TableSortByFieldState[];
}

export function useManagedSort({ sortByBehavior, setSortColumns, sortBy }: ManagedSortProps) {
  useEffect(() => {
    if (sortByBehavior === 'managed' && sortBy) {
      setSortColumns(
        sortBy.map(({ displayName, desc }) => ({
          columnKey: displayName,
          direction: desc === true ? 'DESC' : 'ASC',
        }))
      );
    }
  }, [setSortColumns, sortBy, sortByBehavior]);
}

export function useSortedRows(
  rows: TableRow[],
  fields: Field[],
  nestedFields: Field[],
  { initialSortBy, hasNestedFrames }: SortedRowsOptions
): SortedRowsResult {
  const allFields = useMemo(() => [...fields, ...nestedFields], [fields, nestedFields]);
  const initialSortColumns = useMemo<SortColumn[]>(
    () =>
      initialSortBy?.flatMap(({ displayName, desc }) => {
        if (!allFields.some((f) => getDisplayName(f) === displayName)) {
          return [];
        }
        return [
          {
            columnKey: displayName,
            direction: desc ? ('DESC' as const) : ('ASC' as const),
          },
        ];
      }) ?? [],
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [sortColumns, setSortColumns] = useState<SortColumn[]>(initialSortColumns);
  const columnTypes = useMemo(() => getColumnTypes(fields), [fields]);

  const sortedRows = useMemo(
    () => applySort(rows, fields, sortColumns, columnTypes, hasNestedFrames),
    [rows, fields, sortColumns, columnTypes, hasNestedFrames]
  );

  return {
    rows: sortedRows,
    sortColumns,
    setSortColumns,
  };
}
