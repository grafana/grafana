import { useState, useMemo } from 'react';

import { Field, formattedValueToString } from '@grafana/data';

import { FilterType, TableRow } from './types';
import { getDisplayName, getIsNestedTable, processNestedTableRows } from './utils';

interface TableFiltersAndSort {
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
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

export function useTableFiltersAndSorts(rows: TableRow[], fields: Field[]): TableFiltersAndSort {
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

  // TODO add sorting in here.

  return {
    filter,
    setFilter,
    renderedRows: filteredRows,
    crossFilterOrder,
    crossFilterRows,
  };
}
