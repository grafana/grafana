import { act, renderHook } from '@testing-library/react';

import { createDataFrame, FieldType } from '@grafana/data';

import { TABLE } from '../constants';
import { compileFrameToRecords } from '../utils/rows';

import { usePaginatedRows } from './pagination';
import { setupData } from './testHelpers';

describe('usePaginatedRows', () => {
  it('should return defaults for pagination values when pagination is disabled', () => {
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        rowHeight: 30,
        height: 300,
        width: 800,
        enabled: false,
        headerHeight: TABLE.HEADER_HEIGHT,
        footerHeight: 0,
      })
    );

    expect(result.current.page).toBe(-1);
    expect(result.current.rowsPerPage).toBe(0);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(3);
  });

  it('should handle pagination correctly', () => {
    // with the numbers provided here, we have 3 rows, with 2 rows per page, over 2 pages total.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 60,
        width: 800,
        rowHeight: 10,
        headerHeight: 0,
        footerHeight: 0,
      })
    );

    expect(result.current.page).toBe(0);
    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(2);
    expect(result.current.rows.length).toBe(2);

    act(() => {
      result.current.setPage(1);
    });

    expect(result.current.page).toBe(1);
    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(1);
  });

  it('should handle header and footer correctly', () => {
    // with the numbers provided here, we have 3 rows, with 2 rows per page, over 2 pages total.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 140,
        width: 800,
        rowHeight: 10,
        headerHeight: TABLE.HEADER_HEIGHT,
        footerHeight: 45,
      })
    );

    expect(result.current.page).toBe(0);
    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(2);
    expect(result.current.rows.length).toBe(2);

    act(() => {
      result.current.setPage(1);
    });

    expect(result.current.page).toBe(1);
    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(1);
  });

  it('should handle nested frames correctly', () => {
    const { fields } = setupData();
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['1', '2', '3', '4', '5'], config: {} },
        {
          name: 'nested',
          type: FieldType.nestedFrames,
          values: Array(5).fill([[createDataFrame({ fields })]]),
          config: {},
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(
      frame.fields.map((f) => f.name),
      'nested'
    );
    const rows = frameToRecords(frame);
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 140,
        width: 800,
        rowHeight: 10,
        headerHeight: TABLE.HEADER_HEIGHT,
        footerHeight: 45,
        hasNestedFrames: true,
      })
    );

    expect(result.current.page).toBe(0);
    expect(result.current.rows.length).toBe(4);
    expect(result.current.rows[0].__index).toBe(0);
    expect(result.current.rows[1].__index).toBe(0);
    expect(result.current.rows[2].__index).toBe(1);
    expect(result.current.rows[3].__index).toBe(1);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(2);
    expect(result.current.rowsPerPage).toBe(2);

    act(() => {
      result.current.setPage(1);
    });

    expect(result.current.page).toBe(1);
    expect(result.current.rows.length).toBe(4);
    expect(result.current.rows[0].__index).toBe(2);
    expect(result.current.rows[1].__index).toBe(2);
    expect(result.current.rows[2].__index).toBe(3);
    expect(result.current.rows[3].__index).toBe(3);
    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(4);
    expect(result.current.rowsPerPage).toBe(2);

    act(() => {
      result.current.setPage(2);
    });

    expect(result.current.page).toBe(2);
    expect(result.current.rows.length).toBe(2);
    expect(result.current.rows[0].__index).toBe(4);
    expect(result.current.rows[1].__index).toBe(4);
    expect(result.current.pageRangeStart).toBe(5);
    expect(result.current.pageRangeEnd).toBe(5);
    expect(result.current.rowsPerPage).toBe(2);
  });

  it('should use pageSize for rowsPerPage instead of deriving it from the panel height', () => {
    // height alone would fit all 3 rows on one page ((300 - 38) / 10 = 26 rows); pageSize must win.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 300,
        width: 800,
        rowHeight: 10,
        headerHeight: 0,
        footerHeight: 0,
        pageSize: 2,
      })
    );

    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.numPages).toBe(2);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(2);
    expect(result.current.rows.length).toBe(2);

    act(() => {
      result.current.setPage(1);
    });

    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(1);
    expect(result.current.rows[0].__index).toBe(2);
  });

  it('should fall back to the height-derived page size when pageSize is not a positive number', () => {
    // (60 - 38) / 10 = 2 rows per page from height; pageSize: 0 must not override that.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 60,
        width: 800,
        rowHeight: 10,
        headerHeight: 0,
        footerHeight: 0,
        pageSize: 0,
      })
    );

    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.numPages).toBe(2);
  });

  it('should clamp a fractional pageSize in (0, 1) to one row per page instead of flooring to 0', () => {
    // pageSize 0.5 is positive but floors to 0; without a guard that yields numPages = Infinity and crashes Pagination.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 300,
        width: 800,
        rowHeight: 10,
        headerHeight: 0,
        footerHeight: 0,
        pageSize: 0.5,
      })
    );

    expect(result.current.rowsPerPage).toBe(1);
    expect(result.current.numPages).toBe(3);
    expect(result.current.rows.length).toBe(1);
  });

  it('should clamp the page to the last valid page when pageSize grows and drops the page count', () => {
    // 3 rows. pageSize 1 -> 3 pages (indices 0..2); land on the last page.
    const { rows } = setupData();
    const { result, rerender } = renderHook(
      ({ pageSize }) =>
        usePaginatedRows(rows, {
          enabled: true,
          height: 300,
          width: 800,
          rowHeight: 10,
          headerHeight: 0,
          footerHeight: 0,
          pageSize,
        }),
      { initialProps: { pageSize: 1 } }
    );

    expect(result.current.numPages).toBe(3);

    act(() => {
      result.current.setPage(2);
    });
    expect(result.current.page).toBe(2);

    // pageSize 2 -> 2 pages (indices 0..1). page 2 now overflows and must snap to the last valid page,
    // rather than sitting on an empty page with a broken range summary.
    rerender({ pageSize: 2 });

    expect(result.current.numPages).toBe(2);
    expect(result.current.page).toBe(1);
    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(1);
    expect(result.current.rows[0].__index).toBe(2);
  });
});
