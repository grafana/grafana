import { useState, useMemo } from 'react';
import { SortColumn } from 'react-data-grid';

import { Field, formattedValueToString } from '@grafana/data';

import { ColumnTypes, FilterType, TableRow, TableSortByFieldState } from './types';
import { getComparator, getDisplayName, getIsNestedTable, processNestedTableRows } from './utils';

interface TableFiltersAndSort {
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  sortColumns: SortColumn[];
  setSortColumns: React.Dispatch<React.SetStateAction<SortColumn[]>>;
  renderedRows: TableRow[];
  crossFilterOrder: string[];
  crossFilterRows: { [key: string]: TableRow[] };
}

// Helper function to get displayed value
const getDisplayedValue = (row: TableRow, key: string, fields: Field[]) => {
  const field = fields.find((field) => getDisplayName(field) === key);
  if (!field || !field.display) {
    return '';
  }
  const displayedValue = formattedValueToString(field.display(row[key]));
  return displayedValue;
};

export function useTableFiltersAndSorts(
  rows: TableRow[],
  fields: Field[],
  initialSortBy?: TableSortByFieldState[]
): TableFiltersAndSort {
  const initialSortColumns = useMemo<SortColumn[]>(() => {
    const initialSort = initialSortBy?.map(({ displayName, desc }) => {
      const matchingField = fields.find(({ state }) => state?.displayName === displayName);
      const columnKey = matchingField?.name || displayName;

      return {
        columnKey,
        direction: desc ? ('DESC' as const) : ('ASC' as const),
      };
    });
    return initialSort ?? [];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [sortColumns, setSortColumns] = useState<SortColumn[]>(initialSortColumns);

  const [filter, setFilter] = useState<FilterType>({});
  const filterValues = useMemo(() => Object.entries(filter), [filter]);

  const crossFilterOrder: TableFiltersAndSort['crossFilterOrder'] = useMemo(
    () => Array.from(new Set(filterValues.map(([key]) => key))),
    [filterValues]
  );

  const hasNestedFrames = useMemo(() => getIsNestedTable(fields), [fields]);

  const [filteredRows, crossFilterRows] = useMemo(() => {
    const crossFilterRows: TableFiltersAndSort['crossFilterRows'] = {};
    const filterFn = (row: TableRow): boolean => {
      for (const [key, value] of filterValues) {
        const displayedValue = getDisplayedValue(row, key, fields);
        if (!value.filteredSet.has(displayedValue)) {
          return false;
        }
        // collect rows for crossFilter
        crossFilterRows[key] = crossFilterRows[key] ?? [];
        crossFilterRows[key].push(row);
      }
      return true;
    };
    const filteredRows = hasNestedFrames
      ? processNestedTableRows(rows, (parents) => parents.filter(filterFn))
      : rows.filter(filterFn);
    return [filteredRows, crossFilterRows];
  }, [filterValues, rows, fields, hasNestedFrames]);

  const columnTypes = useMemo(
    () => fields.reduce<ColumnTypes>((acc, field) => ({ ...acc, [getDisplayName(field)]: field.type }), {}),
    [fields]
  );

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
    if (hasNestedFrames) {
      return processNestedTableRows(filteredRows, (parents) => [...parents].sort(compareRows));
    }

    // Regular sort for tables without nesting
    return filteredRows.slice().sort(compareRows);
  }, [filteredRows, sortColumns, columnTypes, hasNestedFrames]);

  return {
    filter,
    setFilter,
    renderedRows: sortedRows,
    crossFilterOrder,
    crossFilterRows,
    sortColumns,
    setSortColumns,
  };
}
