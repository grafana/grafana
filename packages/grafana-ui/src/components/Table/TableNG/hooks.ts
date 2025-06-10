import { useState, useMemo, useEffect } from 'react';
import { SortColumn } from 'react-data-grid';

import { Field, formattedValueToString } from '@grafana/data';

import { TABLE } from './constants';
import { ColumnTypes, FilterType, TableRow, TableSortByFieldState } from './types';
import { getComparator, getDisplayName, getIsNestedTable, processNestedTableRows } from './utils';

export interface ProcessedRowsOptions {
  height: number;
  width: number;
  initialSortBy?: TableSortByFieldState[];
  enablePagination?: boolean;
  paginationHeight?: number;
  hasFooter?: boolean;
  defaultRowHeight?: number;
  headerCellHeight?: number;
  panelPaddingHeight?: number;
}

interface TableFiltersAndSort {
  // --- rows --- //
  renderedRows: TableRow[];
  numRows: number;
  // --- filters --- //
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  crossFilterOrder: string[];
  crossFilterRows: { [key: string]: TableRow[] };
  // --- sorting --- //
  sortColumns: SortColumn[];
  setSortColumns: React.Dispatch<React.SetStateAction<SortColumn[]>>;
  // --- pagination --- //
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  numPages: number;
  rowsPerPage: number;
  pageRangeStart: number;
  pageRangeEnd: number;
  smallPagination: boolean;
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

export function useProcessedRows(
  rows: TableRow[],
  fields: Field[],
  {
    height,
    width,
    hasFooter = false,
    initialSortBy,
    enablePagination,
    paginationHeight,
    defaultRowHeight,
    headerCellHeight,
    panelPaddingHeight,
  }: ProcessedRowsOptions
): TableFiltersAndSort {
  // TODO: allow persisted filter selection via url
  const [filter, setFilter] = useState<FilterType>({});
  const filterValues = useMemo(() => Object.entries(filter), [filter]);

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

  const crossFilterOrder: TableFiltersAndSort['crossFilterOrder'] = useMemo(
    () => Array.from(new Set(filterValues.map(([key]) => key))),
    [filterValues]
  );

  // TODO: allow persisted page selection via url
  const [page, setPage] = useState(0);

  const hasNestedFrames = useMemo(() => getIsNestedTable(fields), [fields]);

  const [filteredRows, crossFilterRows] = useMemo(() => {
    const crossFilterRows: TableFiltersAndSort['crossFilterRows'] = {};

    const filterRows = (row: TableRow): boolean => {
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
      ? processNestedTableRows(rows, (parents) => parents.filter(filterRows))
      : rows.filter(filterRows);

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

  // the number of rows after filtering and sorting, but before paginating. this is the "true"
  // total number of rows which the table may render.
  const numRows = sortedRows.length;

  // using dimensions of the panel, calculate pagination parameters
  const { numPages, rowsPerPage, pageRangeStart, pageRangeEnd, smallPagination } = useMemo((): {
    numPages: number;
    rowsPerPage: number;
    pageRangeStart: number;
    pageRangeEnd: number;
    smallPagination: boolean;
  } => {
    if (!enablePagination) {
      return { numPages: 0, rowsPerPage: 0, pageRangeStart: 1, pageRangeEnd: numRows, smallPagination: false };
    }

    // calculate number of rowsPerPage based on height stack
    let rowsPerPage = Math.floor(
      (height -
        (headerCellHeight ?? 0) -
        TABLE.SCROLL_BAR_WIDTH -
        (paginationHeight ?? 0) -
        (panelPaddingHeight ?? 0)) /
        (defaultRowHeight ?? 1)
    );
    // if footer calcs are on, remove one row per page
    if (hasFooter) {
      rowsPerPage -= 1;
    }
    if (rowsPerPage < 1) {
      // avoid 0 or negative rowsPerPage
      rowsPerPage = 1;
    }

    // calculate row range for pagination summary display
    const pageRangeStart = page * rowsPerPage + 1;
    let pageRangeEnd = pageRangeStart + rowsPerPage - 1;
    if (pageRangeEnd > numRows) {
      pageRangeEnd = numRows;
    }
    const smallPagination = width < TABLE.PAGINATION_LIMIT;
    const numPages = Math.ceil(numRows / rowsPerPage);
    return {
      numPages,
      rowsPerPage,
      pageRangeStart,
      pageRangeEnd,
      smallPagination,
    };
  }, [
    width,
    height,
    hasFooter,
    headerCellHeight,
    paginationHeight,
    defaultRowHeight,
    panelPaddingHeight,
    numRows,
    page,
    enablePagination,
  ]);

  // safeguard against page overflow on panel resize or other factors
  useEffect(() => {
    if (!enablePagination) {
      return;
    }

    if (page > numPages) {
      // resets pagination to end
      setPage(numPages - 1);
    }
  }, [numPages, enablePagination, page, setPage]);

  // apply pagination to the sorted rows
  const paginatedRows = useMemo(() => {
    if (!enablePagination) {
      return sortedRows;
    }
    const pageOffset = page * rowsPerPage;
    return sortedRows.slice(pageOffset, pageOffset + rowsPerPage);
  }, [page, rowsPerPage, sortedRows, enablePagination]);

  return {
    renderedRows: paginatedRows,
    numRows,
    filter,
    setFilter,
    crossFilterOrder,
    crossFilterRows,
    sortColumns,
    setSortColumns,
    page: enablePagination ? page : -1,
    setPage,
    numPages,
    rowsPerPage,
    pageRangeStart,
    pageRangeEnd,
    smallPagination,
  };
}
