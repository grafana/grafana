import { type CSSProperties, useLayoutEffect, useMemo, useState } from 'react';

import { TABLE } from '../constants';
import { type TableRow } from '../types';

export interface PaginatedRowsOptions {
  height: number;
  width: number;
  rowHeight: NonNullable<CSSProperties['height']> | ((row: TableRow) => number);
  headerHeight: number;
  footerHeight: number;
  paginationHeight?: number;
  enabled: boolean;
  hasNestedFrames?: boolean;
  /** When set to a positive value, fixes the number of rows per page instead of deriving it from the panel height. */
  pageSize?: number;
}

export interface PaginatedRowsResult {
  rows: TableRow[];
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  numPages: number;
  numRows: number;
  rowsPerPage: number;
  pageRangeStart: number;
  pageRangeEnd: number;
  smallPagination: boolean;
}

// hand-measured. pagination height is 30px, plus 8px top margin
const PAGINATION_HEIGHT = 38;

export function usePaginatedRows(
  rows: TableRow[],
  { height, width, headerHeight, footerHeight, rowHeight, enabled, hasNestedFrames, pageSize }: PaginatedRowsOptions
): PaginatedRowsResult {
  // TODO: allow persisted page selection via url
  const [page, setPage] = useState(0);
  const numRows = useMemo(() => rows.filter((r) => r.__depth === 0).length, [rows]);

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

    // we'll just measure 100 rows to estimate (skipping nested rows. we don't want to consider nested rows to avoid hiding and showing
    // them as they are collapsed and expanded)
    let sum = 0;
    let count = 0;
    for (let i = 0; i < Math.min(100, rows.length); i++) {
      const row = rows[i];
      if (row.__depth > 0) {
        continue;
      }
      sum += rowHeight(rows[i]);
      count++;
    }
    return sum / count;
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

    // a user-configured page size takes precedence; otherwise derive rowsPerPage from the height stack
    let rowsPerPage: number;
    if (pageSize != null && pageSize > 0) {
      // ensure at least one row per page so a fractional size in (0, 1) doesn't floor to 0
      rowsPerPage = Math.max(1, Math.floor(pageSize));
    } else {
      const rowAreaHeight = height - headerHeight - footerHeight - PAGINATION_HEIGHT;
      const heightPerRow = Math.floor(rowAreaHeight / (avgRowHeight || 1));
      // ensure at least one row per page is displayed
      rowsPerPage = heightPerRow > 1 ? heightPerRow : 1;
    }

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
  }, [height, headerHeight, footerHeight, avgRowHeight, enabled, numRows, page, pageSize]);

  // safeguard against page overflow on panel resize or other factors
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    // valid page indices are 0..numPages-1, so anything at or past numPages overflows
    if (page > numPages - 1) {
      // resets pagination to the last valid page
      setPage(Math.max(0, numPages - 1));
    }
  }, [numPages, enabled, page, setPage]);

  // apply pagination to the sorted rows
  const paginatedRows = useMemo(() => {
    if (!enabled) {
      return rows;
    }

    const result = [];
    const pageOffset = page * rowsPerPage;

    let count = hasNestedFrames ? -1 * pageOffset : 0;
    let i = hasNestedFrames ? 0 : pageOffset;
    while (count <= rowsPerPage && i < rows.length) {
      const currRow = rows[i];
      i++;

      if (currRow.__depth === 0) {
        count++;
      }
      if (count >= 1 && count <= rowsPerPage) {
        result.push(currRow);
      }
    }

    return result;
  }, [page, rowsPerPage, rows, enabled, hasNestedFrames]);

  return {
    rows: paginatedRows,
    page: enabled ? page : -1,
    numRows,
    setPage,
    numPages,
    rowsPerPage,
    pageRangeStart,
    pageRangeEnd,
    smallPagination,
  };
}
