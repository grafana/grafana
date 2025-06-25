import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Column, DataGridProps, SortColumn } from 'react-data-grid';

import { Field, fieldReducers, FieldType, formattedValueToString, reduceField } from '@grafana/data';

import { useTheme2 } from '../../../themes/ThemeContext';
import { TableCellDisplayMode, TableColumnResizeActionCallback } from '../types';

import { TABLE } from './constants';
import { ColumnTypes, FilterType, TableFooterCalc, TableRow, TableSortByFieldState, TableSummaryRow } from './types';
import { getDisplayName, processNestedTableRows, getCellHeightCalculator, applySort, getCellOptions } from './utils';

// Helper function to get displayed value
const getDisplayedValue = (row: TableRow, key: string, fields: Field[]) => {
  const field = fields.find((field) => getDisplayName(field) === key);
  if (!field || !field.display) {
    return '';
  }
  const displayedValue = formattedValueToString(field.display(row[key]));
  return displayedValue;
};

export interface FilteredRowsResult {
  rows: TableRow[];
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  crossFilterOrder: string[];
  crossFilterRows: Record<string, TableRow[]>;
}

export interface FilteredRowsOptions {
  hasNestedFrames: boolean;
}

export function useFilteredRows(
  rows: TableRow[],
  fields: Field[],
  { hasNestedFrames }: FilteredRowsOptions
): FilteredRowsResult {
  // TODO: allow persisted filter selection via url
  const [filter, setFilter] = useState<FilterType>({});
  const filterValues = useMemo(() => Object.entries(filter), [filter]);

  const crossFilterOrder: FilteredRowsResult['crossFilterOrder'] = useMemo(
    () => Array.from(new Set(filterValues.map(([key]) => key))),
    [filterValues]
  );

  const [filteredRows, crossFilterRows] = useMemo(() => {
    const crossFilterRows: FilteredRowsResult['crossFilterRows'] = {};

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

  return {
    rows: filteredRows,
    filter,
    setFilter,
    crossFilterOrder,
    crossFilterRows,
  };
}

export interface SortedRowsOptions {
  columnTypes: ColumnTypes;
  hasNestedFrames: boolean;
  initialSortBy?: TableSortByFieldState[];
}

export interface SortedRowsResult {
  rows: TableRow[];
  sortColumns: SortColumn[];
  setSortColumns: React.Dispatch<React.SetStateAction<SortColumn[]>>;
}

export function useSortedRows(
  rows: TableRow[],
  fields: Field[],
  { initialSortBy, columnTypes, hasNestedFrames }: SortedRowsOptions
): SortedRowsResult {
  const initialSortColumns = useMemo<SortColumn[]>(
    () =>
      initialSortBy?.flatMap(({ displayName, desc }) => {
        if (!fields.some((f) => getDisplayName(f) === displayName)) {
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

  const sortedRows = useMemo(
    () => applySort(rows, fields, sortColumns, columnTypes, hasNestedFrames),
    [rows, fields, sortColumns, hasNestedFrames, columnTypes]
  );

  return {
    rows: sortedRows,
    sortColumns,
    setSortColumns,
  };
}

export interface PaginatedRowsOptions {
  height: number;
  width: number;
  rowHeight: number | ((row: TableRow) => number);
  hasHeader?: boolean;
  hasFooter?: boolean;
  paginationHeight?: number;
  enabled?: boolean;
}

export interface PaginatedRowsResult {
  rows: TableRow[];
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  numPages: number;
  rowsPerPage: number;
  pageRangeStart: number;
  pageRangeEnd: number;
  smallPagination: boolean;
}

// hand-measured. pagination height is 30px, plus 8px top margin
const PAGINATION_HEIGHT = 38;

export function usePaginatedRows(
  rows: TableRow[],
  { height, width, hasHeader, hasFooter, rowHeight, enabled }: PaginatedRowsOptions
): PaginatedRowsResult {
  // TODO: allow persisted page selection via url
  const [page, setPage] = useState(0);
  const numRows = rows.length;

  // calculate average row height if row height is variable.
  const avgRowHeight = useMemo(() => {
    if (typeof rowHeight === 'number') {
      return rowHeight;
    }
    return rows.reduce((avg, row, _, { length }) => avg + rowHeight(row) / length, 0);
  }, [rows, rowHeight]);

  // using dimensions of the panel, calculate pagination parameters
  const { numPages, rowsPerPage, pageRangeStart, pageRangeEnd, smallPagination } = useMemo((): {
    numPages: number;
    rowsPerPage: number;
    pageRangeStart: number;
    pageRangeEnd: number;
    smallPagination: boolean;
  } => {
    if (!enabled) {
      return { numPages: 0, rowsPerPage: 0, pageRangeStart: 1, pageRangeEnd: numRows, smallPagination: false };
    }

    // calculate number of rowsPerPage based on height stack
    const rowAreaHeight =
      height - (hasHeader ? TABLE.HEADER_ROW_HEIGHT : 0) - (hasFooter ? avgRowHeight : 0) - PAGINATION_HEIGHT;
    const heightPerRow = Math.floor(rowAreaHeight / (avgRowHeight || 1));
    // ensure at least one row per page is displayed
    let rowsPerPage = heightPerRow > 1 ? heightPerRow : 1;

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
  }, [width, height, hasHeader, hasFooter, avgRowHeight, enabled, numRows, page]);

  // safeguard against page overflow on panel resize or other factors
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (page > numPages) {
      // resets pagination to end
      setPage(numPages - 1);
    }
  }, [numPages, enabled, page, setPage]);

  // apply pagination to the sorted rows
  const paginatedRows = useMemo(() => {
    if (!enabled) {
      return rows;
    }
    const pageOffset = page * rowsPerPage;
    return rows.slice(pageOffset, pageOffset + rowsPerPage);
  }, [page, rowsPerPage, rows, enabled]);

  return {
    rows: paginatedRows,
    page: enabled ? page : -1,
    setPage,
    numPages,
    rowsPerPage,
    pageRangeStart,
    pageRangeEnd,
    smallPagination,
  };
}

export interface FooterCalcsOptions {
  enabled?: boolean;
  isCountRowsSet?: boolean;
  footerOptions?: TableFooterCalc;
}

export function useFooterCalcs(
  rows: TableRow[],
  fields: Field[],
  { enabled, footerOptions, isCountRowsSet }: FooterCalcsOptions
): string[] {
  return useMemo(() => {
    const footerReducers = footerOptions?.reducer;

    if (!enabled || !footerOptions || !Array.isArray(footerReducers) || !footerReducers.length) {
      return [];
    }

    return fields.map((field, index) => {
      if (field.state?.calcs) {
        delete field.state?.calcs;
      }

      if (isCountRowsSet) {
        return index === 0 ? `${rows.length}` : '';
      }

      if (index === 0) {
        const footerCalcReducer = footerReducers[0];
        return footerCalcReducer ? fieldReducers.get(footerCalcReducer).name : '';
      }

      if (field.type !== FieldType.number) {
        return '';
      }

      // if field.display is undefined, don't throw
      const displayFn = field.display;
      if (!displayFn) {
        return '';
      }

      // If fields array is specified, only show footer for fields included in that array
      if (footerOptions.fields?.length && !footerOptions.fields?.includes(getDisplayName(field))) {
        return '';
      }

      const calc = footerReducers[0];
      const value = reduceField({
        field: {
          ...field,
          values: rows.map((row) => row[getDisplayName(field)]),
        },
        reducers: footerReducers,
      })[calc];

      return formattedValueToString(displayFn(value));
    });
  }, [fields, enabled, footerOptions, isCountRowsSet, rows]);
}

export function useTextWraps(fields: Field[]): Record<string, boolean> {
  return useMemo(
    () =>
      fields.reduce<{ [key: string]: boolean }>((acc, field) => {
        const cellOptions = getCellOptions(field);
        const displayName = getDisplayName(field);
        const wrapText = 'wrapText' in cellOptions && cellOptions.wrapText;
        return { ...acc, [displayName]: !!wrapText };
      }, {}),
    [fields]
  );
}

export function useTypographyCtx() {
  const theme = useTheme2();
  const { ctx, font, avgCharWidth } = useMemo(() => {
    const font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    // set in grafana/data in createTypography.ts
    const letterSpacing = 0.15;

    ctx.letterSpacing = `${letterSpacing}px`;
    ctx.font = font;
    const txt =
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s";
    const txtWidth = ctx.measureText(txt).width;
    const avgCharWidth = txtWidth / txt.length + letterSpacing;

    return {
      ctx,
      font,
      avgCharWidth,
    };
  }, [theme.typography.fontSize, theme.typography.fontFamily]);
  return { ctx, font, avgCharWidth };
}

export function useRowHeight(
  columnWidths: number[],
  fields: Field[],
  hasNestedFrames: boolean,
  defaultRowHeight: number,
  expandedRows: Record<string, boolean>
): number | ((row: TableRow) => number) {
  const [wrappedColIdxs, hasWrappedCols] = useMemo(() => {
    let hasWrappedCols = false;
    return [
      fields.map((field) => {
        if (field.type !== FieldType.string) {
          return false;
        }

        const cellOptions = getCellOptions(field);
        const wrapText = 'wrapText' in cellOptions && cellOptions.wrapText;
        const type = cellOptions.type;
        const result = !!wrapText && type !== TableCellDisplayMode.Image;
        if (result === true) {
          hasWrappedCols = true;
        }
        return result;
      }),
      hasWrappedCols,
    ];
  }, [fields]);

  const { ctx, avgCharWidth } = useTypographyCtx();

  const rowHeight = useMemo(() => {
    // row height is only complicated when there are nested frames or wrapped columns.
    if (!hasNestedFrames && !hasWrappedCols) {
      return defaultRowHeight;
    }

    const HPADDING = TABLE.CELL_PADDING;
    const VPADDING = TABLE.CELL_PADDING;
    const BORDER_RIGHT = 0.666667;
    const LINE_HEIGHT = 22;

    const wrapWidths = columnWidths.map((c) => c - 2 * HPADDING - BORDER_RIGHT);
    const calc = getCellHeightCalculator(ctx, LINE_HEIGHT, defaultRowHeight, VPADDING);

    return (row: TableRow) => {
      // nested rows
      if (Number(row.__depth) > 0) {
        // if unexpanded, height === 0
        if (!expandedRows[row.__index]) {
          return 0;
        }

        // Ensure we have a minimum height (defaultRowHeight) for the nested table even if data is empty
        const headerCount = row?.data?.meta?.custom?.noHeader ? 0 : 1;
        const rowCount = row.data?.length ?? 0;
        return Math.max(defaultRowHeight, defaultRowHeight * (rowCount + headerCount));
      }

      // regular rows
      let maxLines = 1;
      let maxLinesIdx = -1;
      let maxLinesText = '';

      for (let i = 0; i < columnWidths.length; i++) {
        if (wrappedColIdxs[i]) {
          const cellTextRaw = fields[i].values[row.__index];
          if (cellTextRaw != null) {
            const cellText = String(cellTextRaw);
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

      if (maxLinesIdx === -1) {
        return defaultRowHeight;
      }

      return calc(maxLinesText, wrapWidths[maxLinesIdx]);
    };
  }, [
    avgCharWidth,
    columnWidths,
    ctx,
    defaultRowHeight,
    expandedRows,
    fields,
    hasNestedFrames,
    hasWrappedCols,
    wrappedColIdxs,
  ]);

  return rowHeight;
}

/**
 * react-data-grid is a little unwieldy when it comes to column resize events.
 * we want to detect a few different column resize signals:
 *   - dragging the handle (only want to dispatch when handle is released)
 *   - double-clicking the handle (sets the column to the minimum width to fit content)
 * `onColumnResize` dispatches events throughout a dragged resize, and `onColumnWidthsChanged` doesn't
 * emit an event when double-click resizing occurs, so we have to build something custom on top of these
 * behaviors in order to get everything working.
 */
interface UseColumnResizeState {
  columnKey: string | undefined;
  width: number;
}

const INITIAL_COL_RESIZE_STATE = Object.freeze({ columnKey: undefined, width: 0 }) satisfies UseColumnResizeState;

export function useColumnResize(
  onColumnResize: TableColumnResizeActionCallback = () => {}
): DataGridProps<TableRow, TableSummaryRow>['onColumnResize'] {
  // these must be refs. if we used setState, we would run into race conditions with these event listeners.
  const colResizeState = useRef<UseColumnResizeState>({ ...INITIAL_COL_RESIZE_STATE });
  const pointerIsDown = useRef(false);

  useLayoutEffect(() => {
    function pointerDown(_event: PointerEvent) {
      pointerIsDown.current = true;
    }

    function pointerUp(_event: PointerEvent) {
      pointerIsDown.current = false;
    }

    window.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointerup', pointerUp);

    return () => {
      window.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp);
    };
  });

  const flush = useCallback(() => {
    if (colResizeState.current.columnKey) {
      onColumnResize(colResizeState.current.columnKey, Math.floor(colResizeState.current.width));
      colResizeState.current = { ...INITIAL_COL_RESIZE_STATE };
    }
    window.removeEventListener('click', flush, { capture: true });
  }, [onColumnResize]);

  const dataGridHandler = useCallback(
    (column: Column<TableRow, TableSummaryRow>, width: number) => {
      if (!colResizeState.current.columnKey) {
        window.addEventListener('click', flush, { capture: true });
      }

      colResizeState.current.columnKey = column.key;
      colResizeState.current.width = width;

      // when double clicking to resize, the columnResize will fire while the pointer is still down.
      if (!pointerIsDown.current) {
        flush();
      }
    },
    [flush]
  );

  return dataGridHandler;
}
