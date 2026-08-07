import { type CSSProperties, useMemo } from 'react';

import { type DataFrame, type Field } from '@grafana/data';
import { type SortColumn } from '@grafana/react-data-grid';

import { useTheme2 } from '../../../../themes/ThemeContext';
import { CELL_HORIZONTAL_CHROME, HEADER_ICON_SPACE, TABLE } from '../constants';
import { type NestedRowEntry, type TableRow, type TypographyCtx } from '../types';
import { extractPixelValue, getDisplayName } from '../utils/fields';
import {
  buildCellHeightMeasurers,
  buildHeaderHeightMeasurers,
  createTypographyContext,
  getRowHeight,
} from '../utils/height';

/**
 * Typography context for measuring body text, derived from the current theme.
 */
export function useTypographyCtx(): TypographyCtx {
  const theme = useTheme2();
  return useMemo(
    () =>
      createTypographyContext(
        theme.typography.fontSize,
        theme.typography.fontFamily,
        extractPixelValue(theme.typography.body.letterSpacing!) * theme.typography.fontSize
      ),
    [theme]
  );
}

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
  const measurers = useMemo(() => buildHeaderHeightMeasurers(fields, typographyCtx), [fields, typographyCtx]);

  const columnAvailableWidths = useMemo(
    () =>
      columnWidths.map((c, idx) => {
        if (idx >= fields.length) {
          return 0; // no width available for this column yet
        }

        let width = c - CELL_HORIZONTAL_CHROME;
        const field = fields[idx];

        // filtering icon
        if (field.config?.custom?.filterable) {
          width -= HEADER_ICON_SPACE;
        }
        // sorting icon
        if (sortColumns.some((col) => col.columnKey === getDisplayName(field))) {
          width -= HEADER_ICON_SPACE;
        }
        // type icon
        if (showTypeIcons) {
          width -= HEADER_ICON_SPACE;
        }
        // sadly, the math for this is off by exactly 1 pixel. shrug.
        return Math.floor(width) - 1;
      }),
    [fields, columnWidths, sortColumns, showTypeIcons]
  );

  const headerHeight = useMemo(() => {
    if (!enabled) {
      return 0;
    }
    return getRowHeight(
      fields,
      { __index: -1, __depth: 0 },
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
  defaultNestedHeight: NonNullable<CSSProperties['height']>;
  visibleNestedRowCounts: Array<number | null>;
  typographyCtx: TypographyCtx;
  maxHeight?: number;
  nestedData?: DataFrame[] | undefined;
  nestedRows: NestedRowEntry[];
  nestedFields: Field[];
  nestedColWidths: number[];
  nestedFooterHeight?: number;
}

const getTrueColWidths = (cw: number[]): number[] => cw.map((c) => c - CELL_HORIZONTAL_CHROME);

// TODO: maybe there's a way to decouple the nested rows from the top-level rows here.
export function useRowHeight({
  columnWidths,
  fields,
  defaultHeight,
  defaultNestedHeight,
  typographyCtx,
  maxHeight,
  hasNestedFrames,
  nestedData,
  nestedRows,
  nestedFields,
  nestedColWidths,
  visibleNestedRowCounts,
  nestedFooterHeight = 0,
}: UseRowHeightOptions): NonNullable<CSSProperties['height']> | ((row: TableRow) => number) {
  const nestedMeasurers = useMemo(
    () => buildCellHeightMeasurers(nestedFields, typographyCtx, maxHeight),
    [nestedFields, typographyCtx, maxHeight]
  );

  const totalParentWidth = useMemo(() => columnWidths.reduce((acc, width) => acc + width, 0), [columnWidths]);
  const totalNestedWidth = useMemo(() => nestedColWidths.reduce((acc, width) => acc + width, 0), [nestedColWidths]);
  const nestedHasOverflow = useMemo(() => totalParentWidth < totalNestedWidth, [totalParentWidth, totalNestedWidth]);

  const getNestedRowHeightWithCache = useMemo(() => {
    if (typeof defaultNestedHeight === 'string') {
      return () => 0;
    }

    if ((nestedMeasurers?.length ?? 0) === 0) {
      return () => defaultNestedHeight;
    }

    const nestedRowCache: Array<number[] | undefined> = visibleNestedRowCounts.map((count) =>
      count == null ? undefined : Array(count)
    );

    return (row: TableRow) => {
      if (row.__parentIndex == null) {
        return 0;
      }

      const nestedRowCacheEntry = nestedRowCache[row.__parentIndex];
      if (nestedRowCacheEntry == null) {
        return 0;
      }

      const trueNestedColWidths = getTrueColWidths(nestedColWidths);
      let result = nestedRowCacheEntry[row.__index];
      if (result == null) {
        result = nestedRowCacheEntry[row.__index] = getRowHeight(
          nestedFields,
          row,
          trueNestedColWidths,
          defaultNestedHeight,
          nestedMeasurers
        );
      }
      return result;
    };
  }, [nestedFields, nestedColWidths, defaultNestedHeight, nestedMeasurers, visibleNestedRowCounts]);

  const measurers = useMemo(
    () => buildCellHeightMeasurers(fields, typographyCtx, maxHeight),
    [fields, typographyCtx, maxHeight]
  );
  const hasWrappedCols = (measurers?.length ?? 0) > 0;

  const getRowHeightWithCache = useMemo(() => {
    if (typeof defaultHeight === 'string') {
      return () => 0;
    }

    if (!hasWrappedCols) {
      return () => defaultHeight;
    }

    const trueColWidths = getTrueColWidths(columnWidths);
    const cache: Array<number | undefined> = Array(fields[0].values.length);
    return (row: TableRow) => {
      let result = cache[row.__index];
      if (result == null) {
        result = cache[row.__index] = getRowHeight(fields, row, trueColWidths, defaultHeight, measurers);
      }
      return result;
    };
  }, [fields, columnWidths, defaultHeight, measurers, hasWrappedCols]);

  const rowHeight = useMemo(() => {
    // row height is only complicated when there are nested frames or wrapped columns.
    if (typeof defaultHeight === 'string' || !(hasWrappedCols || hasNestedFrames)) {
      return defaultHeight;
    }

    if (typeof defaultNestedHeight === 'string') {
      return defaultNestedHeight;
    }

    return (row: TableRow): number => {
      // nested rows
      if (row.__depth > 0) {
        // if unexpanded, height === 0
        const visibleNestedRowCount = visibleNestedRowCounts[row.__index];
        if (visibleNestedRowCount == null) {
          return 0;
        }

        // if expanded with no rows, height === no data height
        if (visibleNestedRowCount === 0) {
          return TABLE.NESTED_NO_DATA_HEIGHT + TABLE.CELL_PADDING * 2 + nestedFooterHeight;
        }

        const nestedHeaderHeight = nestedData?.[row.__index]?.meta?.custom?.noHeader ? 0 : defaultNestedHeight;
        const nestedRowsHeight = nestedRows[row.__index].final.reduce(
          (acc, row) => acc + getNestedRowHeightWithCache(row),
          0
        );
        const scrollbarHeight = nestedHasOverflow ? TABLE.SCROLLBAR_AFFORDANCE : 0;
        return nestedRowsHeight + nestedHeaderHeight + nestedFooterHeight + TABLE.CELL_PADDING * 2 + scrollbarHeight;
      }

      return row.__parentIndex != null ? getNestedRowHeightWithCache(row) : getRowHeightWithCache(row);
    };
  }, [
    getNestedRowHeightWithCache,
    getRowHeightWithCache,
    defaultHeight,
    defaultNestedHeight,
    hasNestedFrames,
    hasWrappedCols,
    nestedFooterHeight,
    nestedHasOverflow,
    nestedRows,
    nestedData,
    visibleNestedRowCounts,
  ]);

  return rowHeight;
}

interface UseFlatRowHeightOptions {
  columnWidths: number[];
  fields: Field[];
  defaultHeight: NonNullable<CSSProperties['height']>;
  typographyCtx: TypographyCtx;
  maxHeight?: number;
}

/**
 * Simplified row height hook for flat (non-nested) tables.
 * Unlike `useRowHeight`, this does not handle nested frame rows.
 */
export function useFlatRowHeight({
  columnWidths,
  fields,
  defaultHeight,
  typographyCtx,
  maxHeight,
}: UseFlatRowHeightOptions): NonNullable<CSSProperties['height']> | ((row: TableRow) => number) {
  const measurers = useMemo(
    () => buildCellHeightMeasurers(fields, typographyCtx, maxHeight),
    [fields, typographyCtx, maxHeight]
  );
  const hasWrappedCols = (measurers?.length ?? 0) > 0;

  return useMemo(() => {
    if (typeof defaultHeight === 'string' || !hasWrappedCols) {
      return defaultHeight;
    }

    const trueColWidths = getTrueColWidths(columnWidths);
    const cache: Array<number | undefined> = Array(fields[0]?.values.length ?? 0);
    return (row: TableRow) => {
      let result = cache[row.__index];
      if (result == null) {
        result = cache[row.__index] = getRowHeight(fields, row, trueColWidths, defaultHeight, measurers);
      }
      return result;
    };
  }, [fields, columnWidths, defaultHeight, measurers, hasWrappedCols]);
}
