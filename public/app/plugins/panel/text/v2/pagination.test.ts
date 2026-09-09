import { renderHook, act } from '@testing-library/react';

import { toDataFrame } from '@grafana/data';

import { RenderMode, TextMode } from '../panelcfg.gen';

import { clampPageSize, countRows, fitPageSize, usePagination, type PaginationOptions } from './pagination';
import { MAX_RENDERED_ROWS } from './renderContent';

/** jsdom lays nothing out, so the geometry the hook reads is defined here. */
function measurableBox(contentHeight: () => number, available: number): HTMLElement {
  const container = document.createElement('div');
  const blocks = document.createElement('div');
  const block = document.createElement('div');

  Object.defineProperty(container, 'clientHeight', { value: available });
  Object.defineProperty(block, 'offsetTop', { value: 0 });
  Object.defineProperty(block, 'offsetHeight', { get: contentHeight });

  blocks.appendChild(block);
  container.appendChild(blocks);
  return container;
}

function box(content: number, available: number): HTMLElement {
  return measurableBox(() => content, available);
}

/** Blocks of a fixed height each, so the content grows with the page. */
function boxOfRows(rowHeight: number, available: number, rowsOnPage: () => number): HTMLElement {
  return measurableBox(() => rowHeight * rowsOnPage(), available);
}

function numberedFrame(rows: number) {
  return toDataFrame({ fields: [{ name: 'n', values: Array.from({ length: rows }, (_, i) => i) }] });
}

describe('countRows', () => {
  it('sums the rows of every frame', () => {
    expect(countRows([numberedFrame(3), numberedFrame(4)])).toBe(7);
  });

  it('ignores a frame without fields, which renders no blocks', () => {
    expect(countRows([{ fields: [], length: 12 }, numberedFrame(2)])).toBe(2);
  });
});

describe('clampPageSize', () => {
  it.each([
    ['floors a fractional size', 10.7, 10],
    ['keeps a size in range', 25, 25],
    ['raises a size below one', 0.5, 1],
    ['caps a size at the render ceiling', MAX_RENDERED_ROWS + 500, MAX_RENDERED_ROWS],
  ])('%s', (_name, pageSize, expected) => {
    expect(clampPageSize(pageSize)).toBe(expected);
  });
});

describe('fitPageSize', () => {
  it('fits whole rows only', () => {
    expect(fitPageSize(400, 50)).toBe(8);
    expect(fitPageSize(399, 50)).toBe(7);
  });

  it('keeps a page of one row when the box is shorter than a single row', () => {
    expect(fitPageSize(100, 500)).toBe(1);
  });
});

/** A 150-row render in a 400px panel: paged, with room for 15 estimated rows. */
const defaultOptions: PaginationOptions = {
  content: '- ${__data.fields.n}',
  mode: TextMode.Markdown,
  renderMode: RenderMode.PerRow,
  series: [numberedFrame(150)],
  height: 400,
  width: 1000,
};

describe('usePagination', () => {
  function setup(overrides: Partial<PaginationOptions> = {}, renderedBox?: HTMLElement) {
    const view = renderHook((props: PaginationOptions) => usePagination(props), {
      initialProps: { ...defaultOptions, ...overrides },
    });

    if (renderedBox) {
      act(() => view.result.current.contentRef(renderedBox));
    }

    return view;
  }

  it.each([
    ['the result set is at the threshold', { series: [numberedFrame(100)] }],
    ['the template renders once', { renderMode: RenderMode.Once }],
    ['the panel sizes to its content', { fitContent: true }],
  ])('renders every row in one pass when %s', (_name, overrides) => {
    const { result } = setup(overrides);

    expect(result.current.active).toBe(false);
    expect(result.current.rowWindow).toBeUndefined();
  });

  it('shows no control when the page holds every row, which is not paging', () => {
    const { result } = setup({ pageSize: 200 });

    expect(result.current.active).toBe(false);
    expect(result.current.numPages).toBe(1);
  });

  it('pages a per-row render past the threshold, starting at the first page', () => {
    const { result } = setup({ pageSize: 20 });

    expect(result.current.active).toBe(true);
    expect(result.current.rowWindow).toEqual({ start: 0, count: 20 });
    expect(result.current.numPages).toBe(8);
    expect([result.current.rangeStart, result.current.rangeEnd]).toEqual([1, 20]);
  });

  it('moves the window and the summary to the rows of the page navigated to', () => {
    const { result } = setup({ pageSize: 20 });

    act(() => result.current.setPage(2));

    expect(result.current.rowWindow).toEqual({ start: 40, count: 20 });
    expect([result.current.rangeStart, result.current.rangeEnd]).toEqual([41, 60]);
  });

  it('hands back the same window object while the page has not moved', () => {
    const { result, rerender } = setup({ pageSize: 20 });
    const first = result.current.rowWindow;

    rerender({ ...defaultOptions, pageSize: 20 });

    expect(result.current.rowWindow).toBe(first);
  });

  it('ends the summary at the last row on a page the result set does not fill', () => {
    const { result } = setup({ pageSize: 20 });

    act(() => result.current.setPage(7));

    expect([result.current.rangeStart, result.current.rangeEnd]).toEqual([141, 150]);
  });

  it('falls back to the last page when a smaller result set leaves the page out of range', () => {
    const { result, rerender } = setup({ pageSize: 20 });

    act(() => result.current.setPage(7));
    // 105 rows leave six pages of 20.
    rerender({ ...defaultOptions, pageSize: 20, series: [numberedFrame(105)] });

    expect(result.current.page).toBe(5);
    expect(result.current.rowWindow).toEqual({ start: 100, count: 20 });
  });

  it('fits the page to the panel height until the rendered blocks can be measured', () => {
    // 400 - 38 for the bar, over the 24px estimate, is 15 rows.
    const { result } = setup();

    expect(result.current.rowWindow).toEqual({ start: 0, count: 15 });
  });

  it('refits the page to the height the blocks render at, in the box they render into', () => {
    // 750px over the 15 estimated rows is 50px each, and 6 of those fit the 300px box.
    const { result } = setup({}, box(750, 300));

    expect(result.current.rowWindow).toEqual({ start: 0, count: 6 });
    expect(result.current.numPages).toBe(25);
  });

  it('measures a box that only attaches once the lazy editor has mounted', () => {
    const { result } = setup();
    expect(result.current.rowWindow?.count).toBe(15);

    act(() => result.current.contentRef(box(750, 300)));

    expect(result.current.rowWindow?.count).toBe(6);
  });

  it('holds the refitted page size instead of measuring its own last measurement again', () => {
    const { result, rerender } = setup({}, box(750, 300));

    rerender({ ...defaultOptions });

    expect(result.current.rowWindow).toEqual({ start: 0, count: 6 });
  });

  // Measuring the box rather than the blocks made every resize divide the same box by
  // fewer rows, ratcheting the page down to one.
  it('settles on a page size rather than ratcheting as the box is resized', () => {
    const view = setup();
    const rowsOnPage = () => view.result.current.rowWindow?.count ?? 0;

    act(() => view.result.current.contentRef(boxOfRows(50, 500, rowsOnPage)));
    const settled = rowsOnPage();

    view.rerender({ ...defaultOptions, height: 420 });
    view.rerender({ ...defaultOptions, height: 440 });

    expect(settled).toBe(10);
    expect(rowsOnPage()).toBe(settled);
  });

  it('keeps the configured page size rather than measuring for one', () => {
    const { result } = setup({ pageSize: 20 }, box(750, 300));

    expect(result.current.rowWindow).toEqual({ start: 0, count: 20 });
  });

  it.each([
    ['drops the control to its compact form in a narrow panel', 749, true],
    ['shows the full control once there is room', 750, false],
  ])('%s', (_name, width, expected) => {
    expect(setup({ width }).result.current.smallVersion).toBe(expected);
  });
});
