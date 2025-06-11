import { useState, useMemo, useEffect, useLayoutEffect, RefObject } from 'react';
import { DataGridHandle, SortColumn } from 'react-data-grid';

import { DataFrame, Field, fieldReducers, FieldType, formattedValueToString } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { useTheme2 } from '../../../themes/ThemeContext';

import { TABLE } from './constants';
import {
  ColumnTypes,
  FilterType,
  TableColumn,
  TableFooterCalc,
  TableNGProps,
  TableRow,
  TableSortByFieldState,
} from './types';
import {
  getComparator,
  getDisplayName,
  getIsNestedTable,
  processNestedTableRows,
  getCellHeightCalculator,
  getFooterItemNG,
} from './utils';

export interface ProcessedRowsOptions {
  height: number;
  width: number;
  initialSortBy?: TableSortByFieldState[];
  enablePagination?: boolean;
  paginationHeight?: number;
  hasHeader?: boolean;
  hasFooter?: boolean;
  defaultRowHeight?: number;
  headerCellHeight?: number;
  footerOptions?: TableFooterCalc;
  isCountRowsSet?: boolean;
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
  // --- footer --- //
  footerCalcs: string[];
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
    hasHeader = false,
    hasFooter = false,
    initialSortBy,
    enablePagination,
    paginationHeight,
    defaultRowHeight,
    footerOptions,
    isCountRowsSet,
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
    const rowAreaHeight =
      height -
      (hasHeader ? TABLE.HEADER_ROW_HEIGHT : 0) -
      (hasFooter ? (defaultRowHeight ?? 0) : 0) -
      (paginationHeight ?? 0);
    const heightPerRow = Math.floor(rowAreaHeight / (defaultRowHeight ?? 1));
    // ensure at least one row per page is displayed
    const rowsPerPage = heightPerRow > 1 ? heightPerRow : 1;

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
  }, [width, height, hasHeader, hasFooter, paginationHeight, defaultRowHeight, enablePagination, numRows, page]);

  // calculate footer data
  const footerCalcs = useMemo(() => {
    if (!hasFooter) {
      return [];
    }
    return fields.map((field, index) => {
      if (field.state?.calcs) {
        delete field.state?.calcs;
      }
      if (isCountRowsSet) {
        return index === 0 ? `${numRows}` : '';
      }
      if (index === 0) {
        const footerCalcReducer = footerOptions?.reducer?.[0];
        return footerCalcReducer ? fieldReducers.get(footerCalcReducer).name : '';
      }
      return getFooterItemNG(sortedRows, field, footerOptions);
    });
  }, [fields, hasFooter, footerOptions, sortedRows, isCountRowsSet, numRows]);

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
    footerCalcs,
  };
}

export function useScrollbarWidth(ref: RefObject<DataGridHandle>, { height }: TableNGProps, renderedRows: TableRow[]) {
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useLayoutEffect(
    () => {
      let el = ref.current!.element!;
      setScrollbarWidth(el.offsetWidth - el.clientWidth);
    },
    // TODO: account for pagination, subtable expansion, default row height changes, height changes, data length
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [height, renderedRows]
  );

  return scrollbarWidth;
}

export function useRowHeight(columns: TableColumn[], data: DataFrame, hasSubTable: boolean, defaultRowHeight: number) {
  const theme = useTheme2();

  const wrappedColIdxs = useMemo(
    () =>
      data.fields.map((field) => {
        if (field.type === FieldType.string) {
          const { wrapText = false, type = TableCellDisplayMode.Auto } = field.config.custom?.cellOptions ?? {};
          return wrapText && type !== TableCellDisplayMode.Image;
        }
        return false;
      }),
    [data]
  );

  const { ctx, avgCharWidth } = useMemo(() => {
    const font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    // set in grafana/data in createTypography.ts
    const letterSpacing = 0.15;

    ctx.letterSpacing = `${letterSpacing}px`;
    ctx.font = font;
    let txt =
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s";
    const txtWidth = ctx.measureText(txt).width;
    const avgCharWidth = txtWidth / txt.length + letterSpacing;

    return {
      ctx,
      font,
      avgCharWidth,
    };
  }, [theme.typography.fontSize, theme.typography.fontFamily]);

  const rowHeight = useMemo(() => {
    if (hasSubTable || wrappedColIdxs.some((v) => v)) {
      const HPADDING = 6;
      const BORDER_RIGHT = 0.666667;
      const lineHeight = 22;
      const VPADDING = 6;

      const wrapWidths = columns.map((c) => Number(c.width) - 2 * HPADDING - BORDER_RIGHT);

      // TODO: pass line height, row height, padding here
      const calc = getCellHeightCalculator(ctx, lineHeight, defaultRowHeight, VPADDING);

      const getRowHeight = ({ __index: rowIdx }: TableRow) => {
        let maxLines = 1;
        let maxLinesIdx = -1;
        let maxLinesText = '';

        for (let i = 0; i < columns.length; i++) {
          if (wrappedColIdxs[i]) {
            const cellText = String(columns[i].field.values[rowIdx]);

            if (cellText != null) {
              const charsPerLine = wrapWidths[i] / avgCharWidth;
              const approxLines = cellText.length / charsPerLine;

              if (approxLines > maxLines) {
                maxLines = approxLines;
                maxLinesIdx = i;
                maxLinesText = cellText;
              }
            }
          }
        }

        return maxLinesIdx === -1 ? defaultRowHeight : calc(maxLinesText, wrapWidths[maxLinesIdx]);
      };

      return getRowHeight;
    }

    return defaultRowHeight;
  }, [wrappedColIdxs, hasSubTable, columns, defaultRowHeight, avgCharWidth, ctx]);

  return rowHeight;
}
