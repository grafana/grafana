import { useMemo, useState } from 'react';
import { SortColumn } from 'react-data-grid';

import { Field } from '@grafana/data';

import { TableRow } from './types';
import { applySort, getColumnTypes } from './utils';

export interface SortedRowsOptions {
  customSort?: typeof applySort;
  initialSortColumns?: SortColumn[];
  sortColumns?: SortColumn[];
}

export interface SortedRowsResult {
  rows: TableRow[];
  sortColumns: SortColumn[];
  setSortColumns: React.Dispatch<React.SetStateAction<SortColumn[]>>;
}

export function useSortedRows(
  rows: TableRow[],
  fields: Field[],
  { initialSortColumns = [], customSort, sortColumns: controlledSortColumns }: SortedRowsOptions
): SortedRowsResult {
  const [sortColumns, setSortColumns] = useState<SortColumn[]>(controlledSortColumns ?? initialSortColumns);
  const columnTypes = useMemo(() => getColumnTypes(fields), [fields]);

  const sortedRows = useMemo(
    () => (customSort ?? applySort)(rows, fields, sortColumns, columnTypes),
    [customSort, rows, fields, sortColumns, columnTypes]
  );

  return {
    rows: sortedRows,
    sortColumns,
    setSortColumns,
  };
}
