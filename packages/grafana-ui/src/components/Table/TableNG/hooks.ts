import { useState, useMemo, useCallback, useRef, useLayoutEffect, RefObject, CSSProperties, useEffect } from 'react';
import { Column, DataGridHandle, DataGridProps, SortColumn } from 'react-data-grid';

import {
  compareArrayValues,
  Field,
  fieldReducers,
  FieldType,
  formattedValueToString,
  reduceField,
} from '@grafana/data';

import { TableColumnResizeActionCallback } from '../types';

import { TABLE } from './constants';
import { FilterType, TableFooterCalc, TableRow, TableSortByFieldState, TableSummaryRow, TypographyCtx } from './types';
import {
  getDisplayName,
  processNestedTableRows,
  applySort,
  getColumnTypes,
  getRowHeight,
  computeColWidths,
  buildHeaderHeightMeasurers,
  buildCellHeightMeasurers,
} from './utils';

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
  { initialSortBy, hasNestedFrames }: SortedRowsOptions
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
  const columnTypes = useMemo(() => getColumnTypes(fields), [fields]);

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
  rowHeight: NonNullable<CSSProperties['height']> | ((row: TableRow) => number);
  headerHeight: number;
  footerHeight: number;
  paginationHeight?: number;
  enabled: boolean;
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
  { height, width, headerHeight, footerHeight, rowHeight, enabled }: PaginatedRowsOptions
): PaginatedRowsResult {
  // TODO: allow persisted page selection via url
  const [page, setPage] = useState(0);
  const numRows = rows.length;

  // calculate average row height if row height is variable.
  const avgRowHeight = useMemo(() => {
    if (!enabled) {
      return 0;
    }

    if (typeof rowHeight === 'number') {
      return rowHeight;
    }

    // when using auto-sized rows, we're just going to have to pick a number. the alternative
    // is to measure each row, which we could do but would be expensive.
    if (typeof rowHeight === 'string') {
      return TABLE.MAX_CELL_HEIGHT;
    }

    // we'll just measure 100 rows to estimate
    return rows.slice(0, 100).reduce((avg, row, _, { length }) => avg + rowHeight(row) / length, 0);
  }, [rows, rowHeight, enabled]);

  const smallPagination = useMemo(() => enabled && width < TABLE.PAGINATION_LIMIT, [enabled, width]);

  // using dimensions of the panel, calculate pagination parameters
  const { numPages, rowsPerPage, pageRangeStart, pageRangeEnd } = useMemo((): {
    numPages: number;
    rowsPerPage: number;
    pageRangeStart: number;
    pageRangeEnd: number;
  } => {
    if (!enabled) {
      return { numPages: 0, rowsPerPage: 0, pageRangeStart: 1, pageRangeEnd: numRows };
    }

    // calculate number of rowsPerPage based on height stack
    const rowAreaHeight = height - headerHeight - footerHeight - PAGINATION_HEIGHT;
    const heightPerRow = Math.floor(rowAreaHeight / (avgRowHeight || 1));
    // ensure at least one row per page is displayed
    let rowsPerPage = heightPerRow > 1 ? heightPerRow : 1;

    // calculate row range for pagination summary display
    const pageRangeStart = page * rowsPerPage + 1;
    let pageRangeEnd = pageRangeStart + rowsPerPage - 1;
    if (pageRangeEnd > numRows) {
      pageRangeEnd = numRows;
    }

    const numPages = Math.ceil(numRows / rowsPerPage);
    return {
      numPages,
      rowsPerPage,
      pageRangeStart,
      pageRangeEnd,
    };
  }, [height, headerHeight, footerHeight, avgRowHeight, enabled, numRows, page]);

  // safeguard against page overflow on panel resize or other factors
  useLayoutEffect(() => {
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
  // it's very important that this is the _visible_ fields.
  fields: Field[],
  { enabled, footerOptions, isCountRowsSet }: FooterCalcsOptions
): string[] {
  return useMemo(() => {
    const footerReducers = footerOptions?.reducer;

    if (!enabled || !footerOptions || !Array.isArray(footerReducers) || !footerReducers.length) {
      return [];
    }

    const fieldNameSet = footerOptions.fields?.length ? new Set(footerOptions.fields) : null;

    return fields.map((field, index) => {
      if (field.state?.calcs) {
        delete field.state?.calcs;
      }

      if (isCountRowsSet) {
        return index === 0 ? `${rows.length}` : '';
      }

      let emptyValue = '';
      if (index === 0) {
        const footerCalcReducer = footerReducers[0];
        emptyValue = footerCalcReducer ? fieldReducers.get(footerCalcReducer).name : '';
      }

      if (field.type !== FieldType.number) {
        return emptyValue;
      }

      // if field.display is undefined, don't throw
      const displayFn = field.display;
      if (!displayFn) {
        return emptyValue;
      }

      // If fields array is specified, only show footer for fields included in that array.
      // the array can include either the display name or the field name. we don't use a field matcher
      // because that requires us to drill the data frame down here.
      if (fieldNameSet && !fieldNameSet.has(getDisplayName(field)) && !fieldNameSet.has(field.name)) {
        return emptyValue;
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

const ICON_WIDTH = 16;
const ICON_GAP = 4;

interface UseHeaderHeightOptions {
  enabled: boolean;
  fields: Field[];
  columnWidths: number[];
  sortColumns: SortColumn[];
  typographyCtx: TypographyCtx;
  showTypeIcons?: boolean;
}

export function useHeaderHeight({
  fields,
  enabled,
  columnWidths,
  sortColumns,
  typographyCtx,
  showTypeIcons = false,
}: UseHeaderHeightOptions): number {
  const perIconSpace = ICON_WIDTH + ICON_GAP;

  const measurers = useMemo(() => buildHeaderHeightMeasurers(fields, typographyCtx), [fields, typographyCtx]);

  const columnAvailableWidths = useMemo(
    () =>
      columnWidths.map((c, idx) => {
        if (idx >= fields.length) {
          return 0; // no width available for this column yet
        }

        let width = c - 2 * TABLE.CELL_PADDING - TABLE.BORDER_RIGHT;
        const field = fields[idx];

        // filtering icon
        if (field.config?.custom?.filterable) {
          width -= perIconSpace;
        }
        // sorting icon
        if (sortColumns.some((col) => col.columnKey === getDisplayName(field))) {
          width -= perIconSpace;
        }
        // type icon
        if (showTypeIcons) {
          width -= perIconSpace;
        }
        // sadly, the math for this is off by exactly 1 pixel. shrug.
        return Math.floor(width) - 1;
      }),
    [fields, columnWidths, sortColumns, showTypeIcons, perIconSpace]
  );

  const headerHeight = useMemo(() => {
    if (!enabled) {
      return 0;
    }
    return getRowHeight(
      fields,
      -1,
      columnAvailableWidths,
      TABLE.HEADER_HEIGHT,
      measurers,
      TABLE.LINE_HEIGHT,
      TABLE.CELL_PADDING
    );
  }, [fields, enabled, columnAvailableWidths, measurers]);

  return headerHeight;
}

interface UseRowHeightOptions {
  columnWidths: number[];
  fields: Field[];
  hasNestedFrames: boolean;
  defaultHeight: NonNullable<CSSProperties['height']>;
  expandedRows: Set<number>;
  typographyCtx: TypographyCtx;
}

export function useRowHeight({
  columnWidths,
  fields,
  hasNestedFrames,
  defaultHeight,
  expandedRows,
  typographyCtx,
}: UseRowHeightOptions): NonNullable<CSSProperties['height']> | ((row: TableRow) => number) {
  const measurers = useMemo(() => buildCellHeightMeasurers(fields, typographyCtx), [fields, typographyCtx]);
  const hasWrappedCols = useMemo(() => measurers?.length ?? 0 > 0, [measurers]);

  const colWidths = useMemo(() => {
    const columnWidthAffordance = 2 * TABLE.CELL_PADDING + TABLE.BORDER_RIGHT;
    return columnWidths.map((c) => c - columnWidthAffordance);
  }, [columnWidths]);

  const rowHeight = useMemo(() => {
    // row height is only complicated when there are nested frames or wrapped columns.
    if ((!hasNestedFrames && !hasWrappedCols) || typeof defaultHeight === 'string') {
      return defaultHeight;
    }

    // this cache should get blown away on resize, data refresh, updated fields, etc.
    // caching by __index is ok because sorting does not modify the __index.
    const cache: Array<number | undefined> = Array(fields[0].values.length);
    return (row: TableRow) => {
      // nested rows
      if (row.__depth > 0) {
        // if unexpanded, height === 0
        if (!expandedRows.has(row.__index)) {
          return 0;
        }

        const rowCount = row.data?.length ?? 0;
        if (rowCount === 0) {
          return TABLE.NESTED_NO_DATA_HEIGHT + TABLE.CELL_PADDING * 2;
        }

        const nestedHeaderHeight = row.data?.meta?.custom?.noHeader ? 0 : defaultHeight;
        return defaultHeight * rowCount + nestedHeaderHeight + TABLE.CELL_PADDING * 2;
      }

      // regular rows
      let result = cache[row.__index];
      if (!result) {
        result = cache[row.__index] = getRowHeight(fields, row.__index, colWidths, defaultHeight, measurers);
      }
      return result;
    };
  }, [hasNestedFrames, hasWrappedCols, defaultHeight, fields, colWidths, measurers, expandedRows]);

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
  // these must be refs. if we used setState, we would run into race conditions with these event listeners
  const colResizeState = useRef<UseColumnResizeState>({ ...INITIAL_COL_RESIZE_STATE });
  const pointerIsDown = useRef(false);

  // to detect whether we got a double-click resize, we track whether the pointer is currently down
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

  const dispatchEvent = useCallback(() => {
    if (colResizeState.current.columnKey) {
      onColumnResize(colResizeState.current.columnKey, Math.floor(colResizeState.current.width));
      colResizeState.current = { ...INITIAL_COL_RESIZE_STATE };
    }
    window.removeEventListener('click', dispatchEvent, { capture: true });
  }, [onColumnResize]);

  // this is the callback that gets passed to react-data-grid
  const dataGridResizeHandler = useCallback(
    (column: Column<TableRow, TableSummaryRow>, width: number) => {
      if (!colResizeState.current.columnKey) {
        window.addEventListener('click', dispatchEvent, { capture: true });
      }

      colResizeState.current.columnKey = column.key;
      colResizeState.current.width = width;

      // when double clicking to resize, this handler will fire, but the pointer will not be down,
      // meaning that we should immediately flush the new width
      if (!pointerIsDown.current) {
        dispatchEvent();
      }
    },
    [dispatchEvent]
  );

  return dataGridResizeHandler;
}

export function useScrollbarWidth(ref: RefObject<DataGridHandle>, height: number) {
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current?.element;

    if (!el) {
      return;
    }

    const updateScrollbarDimensions = () => {
      setScrollbarWidth(el.offsetWidth - el.clientWidth);
    };

    updateScrollbarDimensions();

    const resizeObserver = new ResizeObserver(updateScrollbarDimensions);
    resizeObserver.observe(el);
    return () => {
      resizeObserver.disconnect();
    };
  }, [ref, height]);

  return scrollbarWidth;
}

const numIsEqual = (a: number, b: number) => a === b;

export function useColWidths(
  visibleFields: Field[],
  availableWidth: number,
  frozenColumns?: number
): [number[], number] {
  const [widths, setWidths] = useState<number[]>(computeColWidths(visibleFields, availableWidth));

  // only replace the widths array if something actually changed
  useEffect(() => {
    const newWidths = computeColWidths(visibleFields, availableWidth);
    if (!compareArrayValues(widths, newWidths, numIsEqual)) {
      setWidths(newWidths);
    }
  }, [availableWidth, widths, visibleFields]);

  // this is to avoid buggy situations where all visible columns are frozen
  const numFrozenColsFullyInView = useMemo(() => {
    if (!frozenColumns || frozenColumns <= 0) {
      return -1;
    }

    const fullyVisibleCols = widths.reduce(
      ([count, remainingWidth], nextWidth) => {
        if (remainingWidth - nextWidth >= 0) {
          return [count + 1, remainingWidth - nextWidth];
        }
        return [count, 0];
      },
      [0, availableWidth]
    )[0];

    // de-noise memoized changes to the columns array, and only change this
    // number when the number of frozen columns changes or once there are fewer
    // visible columns than the number of frozen columns.
    return Math.min(fullyVisibleCols, frozenColumns);
  }, [widths, availableWidth, frozenColumns]);

  return [widths, numFrozenColsFullyInView];
}
