import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect, RefObject } from 'react';
import { Column, DataGridHandle, DataGridProps, SortColumn } from 'react-data-grid';
import { varPreLine } from 'uwrap';

import { Field, fieldReducers, FieldType, formattedValueToString, LinkModel, reduceField } from '@grafana/data';

import { useTheme2 } from '../../../themes/ThemeContext';
import { TableCellDisplayMode, TableColumnResizeActionCallback } from '../types';

import { TABLE } from './constants';
import { FilterType, TableFooterCalc, TableRow, TableSortByFieldState, TableSummaryRow } from './types';
import {
  getDisplayName,
  processNestedTableRows,
  applySort,
  getCellOptions,
  getColumnTypes,
  GetMaxWrapCellOptions,
  getMaxWrapCell,
  getCellLinks,
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
  rowHeight: number | ((row: TableRow) => number);
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

    // we'll just measure 100 rows to estimate
    return rows.slice(0, 100).reduce((avg, row, _, { length }) => avg + rowHeight(row) / length, 0);
  }, [rows, rowHeight, enabled]);

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
    const smallPagination = width < TABLE.PAGINATION_LIMIT;
    const numPages = Math.ceil(numRows / rowsPerPage);
    return {
      numPages,
      rowsPerPage,
      pageRangeStart,
      pageRangeEnd,
      smallPagination,
    };
  }, [width, height, headerHeight, footerHeight, avgRowHeight, enabled, numRows, page]);

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

interface TypographyCtx {
  ctx: CanvasRenderingContext2D;
  font: string;
  avgCharWidth: number;
  calcRowHeight: (text: string, cellWidth: number, defaultHeight: number) => number;
}

export function useTypographyCtx(): TypographyCtx {
  const theme = useTheme2();
  const typographyCtx = useMemo((): TypographyCtx => {
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
    const { count } = varPreLine(ctx);

    const calcRowHeight = (text: string, cellWidth: number, defaultHeight: number) => {
      if (text === '') {
        return defaultHeight;
      }
      const numLines = count(text, cellWidth);
      const totalHeight = numLines * TABLE.LINE_HEIGHT + 2 * TABLE.CELL_PADDING;
      return Math.max(totalHeight, defaultHeight);
    };

    return {
      calcRowHeight,
      ctx,
      font,
      avgCharWidth,
    };
  }, [theme.typography.fontSize, theme.typography.fontFamily]);
  return typographyCtx;
}

const ICON_WIDTH = 16;
const ICON_GAP = 4;

interface UseHeaderHeightOptions {
  enabled: boolean;
  fields: Field[];
  columnWidths: number[];
  defaultHeight: number;
  sortColumns: SortColumn[];
  typographyCtx: TypographyCtx;
  showTypeIcons?: boolean;
}

export function useHeaderHeight({
  fields,
  enabled,
  columnWidths,
  defaultHeight,
  sortColumns,
  typographyCtx: { calcRowHeight, avgCharWidth },
  showTypeIcons = false,
}: UseHeaderHeightOptions): number {
  const perIconSpace = ICON_WIDTH + ICON_GAP;
  const columnAvailableWidths = useMemo(
    () =>
      columnWidths.map((c, idx) => {
        let width = c - 2 * TABLE.CELL_PADDING - TABLE.BORDER_RIGHT;
        // filtering icon
        if (fields[idx]?.config?.custom?.filterable) {
          width -= perIconSpace;
        }
        // sorting icon
        if (sortColumns.some((col) => col.columnKey === getDisplayName(fields[idx]))) {
          width -= perIconSpace;
        }
        // type icon
        if (showTypeIcons) {
          width -= perIconSpace;
        }
        return Math.floor(width);
      }),
    [fields, columnWidths, sortColumns, showTypeIcons, perIconSpace]
  );

  const [wrappedColHeaderIdxs, hasWrappedColHeaders] = useMemo(() => {
    let hasWrappedColHeaders = false;
    return [
      fields.map((field) => {
        const wrapText = field.config?.custom?.wrapHeaderText ?? false;
        if (wrapText) {
          hasWrappedColHeaders = true;
        }
        return wrapText;
      }),
      hasWrappedColHeaders,
    ];
  }, [fields]);

  const maxWrapCellOptions = useMemo<GetMaxWrapCellOptions>(
    () => ({
      colWidths: columnAvailableWidths,
      avgCharWidth,
      wrappedColIdxs: wrappedColHeaderIdxs,
    }),
    [columnAvailableWidths, avgCharWidth, wrappedColHeaderIdxs]
  );

  // TODO: is there a less clunky way to subtract the top padding value?
  const headerHeight = useMemo(() => {
    if (!enabled) {
      return 0;
    }
    if (!hasWrappedColHeaders) {
      return defaultHeight - TABLE.CELL_PADDING;
    }

    const { text: maxLinesText, idx: maxLinesIdx } = getMaxWrapCell(fields, -1, maxWrapCellOptions);
    return calcRowHeight(maxLinesText, columnAvailableWidths[maxLinesIdx], defaultHeight) - TABLE.CELL_PADDING;
  }, [fields, enabled, hasWrappedColHeaders, maxWrapCellOptions, calcRowHeight, columnAvailableWidths, defaultHeight]);

  return headerHeight;
}

interface UseRowHeightOptions {
  columnWidths: number[];
  fields: Field[];
  hasNestedFrames: boolean;
  defaultHeight: number;
  headerHeight: number;
  expandedRows: Record<string, boolean>;
  typographyCtx: TypographyCtx;
}

export function useRowHeight({
  columnWidths,
  fields,
  hasNestedFrames,
  defaultHeight,
  headerHeight,
  expandedRows,
  typographyCtx: { calcRowHeight, avgCharWidth },
}: UseRowHeightOptions): number | ((row: TableRow) => number) {
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

  const colWidths = useMemo(
    () => columnWidths.map((c) => c - 2 * TABLE.CELL_PADDING - TABLE.BORDER_RIGHT),
    [columnWidths]
  );

  const maxWrapCellOptions = useMemo<GetMaxWrapCellOptions>(
    () => ({
      colWidths,
      avgCharWidth,
      wrappedColIdxs,
    }),
    [colWidths, avgCharWidth, wrappedColIdxs]
  );

  const rowHeight = useMemo(() => {
    // row height is only complicated when there are nested frames or wrapped columns.
    if (!hasNestedFrames && !hasWrappedCols) {
      return defaultHeight;
    }

    return (row: TableRow) => {
      // nested rows
      if (Number(row.__depth) > 0) {
        // if unexpanded, height === 0
        if (!expandedRows[row.__index]) {
          return 0;
        }

        const rowCount = row.data?.length ?? 0;
        if (rowCount === 0) {
          return TABLE.NESTED_NO_DATA_HEIGHT + TABLE.CELL_PADDING * 2;
        }

        const nestedHeaderHeight = row.data?.meta?.custom?.noHeader ? 0 : defaultHeight;
        return Math.max(defaultHeight, defaultHeight * rowCount + nestedHeaderHeight + TABLE.CELL_PADDING * 2);
      }

      // regular rows
      const { text: maxLinesText, idx: maxLinesIdx } = getMaxWrapCell(fields, row.__index, maxWrapCellOptions);
      return calcRowHeight(maxLinesText, colWidths[maxLinesIdx], defaultHeight);
    };
  }, [
    calcRowHeight,
    defaultHeight,
    expandedRows,
    fields,
    hasNestedFrames,
    hasWrappedCols,
    maxWrapCellOptions,
    colWidths,
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

export function useSingleLink(field: Field, rowIdx: number): LinkModel | undefined {
  const linksCount = field.config.links?.length ?? 0;
  const actionsCount = field.config.actions?.length ?? 0;
  const shouldShowLink = linksCount === 1 && actionsCount === 0;
  return useMemo(() => (shouldShowLink ? (getCellLinks(field, rowIdx) ?? []) : [])[0], [field, shouldShowLink, rowIdx]);
}

export function useScrollbarWidth(ref: RefObject<DataGridHandle>, height: number, renderedRows: TableRow[]) {
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current?.element;

    if (el) {
      setScrollbarWidth(el.offsetWidth - el.clientWidth);
    }
  }, [ref, height, renderedRows]);

  return scrollbarWidth;
}
