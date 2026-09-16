import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { createTheme } from '@grafana/data';
import { type DataGridHandle } from '@grafana/react-data-grid';

import { TableDataGrid, type TableDataGridProps } from './TableDataGrid';

function makeProps(overrides: Partial<TableDataGridProps> = {}): TableDataGridProps {
  return {
    role: 'grid',
    gridRef: createRef<DataGridHandle>(),
    columns: [],
    rows: [],
    renderers: {
      renderRow: jest.fn(),
      renderCell: jest.fn(),
    },
    onCellClick: jest.fn(),
    onCellKeyDown: jest.fn(),
    sortColumns: [],
    setSortColumns: jest.fn(),
    rowHeight: 36,
    hasFooter: false,
    footerHeight: 0,
    noHeader: false,
    headerHeight: 36,
    enablePagination: false,
    numRows: 0,
    page: 0,
    setPage: jest.fn(),
    numPages: 1,
    pageRangeStart: 0,
    pageRangeEnd: 0,
    smallPagination: false,
    sortedRows: [],
    onTooltipClose: jest.fn(),
    onInspectCellDismiss: jest.fn(),
    ...overrides,
  };
}

describe('TableDataGrid', () => {
  let origResizeObserver = global.ResizeObserver;
  let resizeObservers: Array<{
    callback: ResizeObserverCallback;
    disconnect: jest.Mock;
  }>;
  let mutationObservers: Array<{
    callback: MutationCallback;
    disconnect: jest.Mock;
  }>;
  let animationFrames: FrameRequestCallback[];
  let origMutationObserver = global.MutationObserver;
  let requestAnimationFrameSpy: jest.SpyInstance;
  let cancelAnimationFrameSpy: jest.SpyInstance;

  beforeEach(() => {
    origResizeObserver = global.ResizeObserver;
    origMutationObserver = global.MutationObserver;
    resizeObservers = [];
    mutationObservers = [];
    animationFrames = [];
    global.ResizeObserver = class ResizeObserver {
      disconnect = jest.fn();

      constructor(public callback: ResizeObserverCallback) {
        resizeObservers.push(this);
      }

      observe() {}
      unobserve() {}
    };
    global.MutationObserver = class MutationObserver {
      disconnect = jest.fn();

      constructor(public callback: MutationCallback) {
        mutationObservers.push(this);
      }

      observe() {}
      takeRecords() {
        return [];
      }
    };
    requestAnimationFrameSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => animationFrames.push(callback));
    cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
      delete animationFrames[handle - 1];
    });
  });

  afterEach(() => {
    global.ResizeObserver = origResizeObserver;
    global.MutationObserver = origMutationObserver;
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  describe('table.refresh', () => {
    it('rounds the grid itself so a row scrolled under the header cannot show through its corners', () => {
      // The header cells round their own top corners, which leaves the area outside the radius
      // transparent. The grid is the scroll container, so rounding it is what clips the rows it
      // scrolls out of that corner.
      const radius = createTheme().shape.radius.default;
      const { unmount } = render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const refreshed = window.getComputedStyle(screen.getByRole('grid'));
      expect(refreshed.getPropertyValue('border-start-start-radius')).toBe(radius);
      expect(refreshed.getPropertyValue('border-start-end-radius')).toBe(radius);

      unmount();

      // the classic header shares the rows' background, so the table stays square
      render(<TableDataGrid {...makeProps()} />);
      const classic = window.getComputedStyle(screen.getByRole('grid'));
      expect(classic.getPropertyValue('border-start-start-radius')).toBe('');
    });
  });

  describe('layout', () => {
    it('lets its wrapper shrink below the content height', () => {
      // The multi-frame panel stacks the frame picker under the table in a flex column. The grid
      // itself could always shrink because it scrolls; the wrapper around it does not, so without
      // an explicit minimum of 0 its flex base size is the whole content height and whatever sits
      // below the table gets pushed out of the panel.
      const { container } = render(<TableDataGrid {...makeProps()} />);
      expect(screen.getByRole('grid').parentElement).toHaveStyle({ 'min-block-size': '0' });
      expect(container.firstElementChild).toHaveStyle({ position: 'relative' });
    });
  });

  describe('scroll shadows', () => {
    // jsdom has no layout, so the grid reports every scroll metric as 0. Fake the viewport the hook
    // reads, then fire the scroll it would have listened to.
    function scrollTo(
      el: HTMLElement,
      {
        scrollTop,
        clientHeight,
        scrollHeight,
        // a horizontal scrollbar is the gap between the two: it eats into the padding box without
        // changing the element's own height
        offsetHeight = clientHeight,
      }: { scrollTop: number; clientHeight: number; scrollHeight: number; offsetHeight?: number }
    ) {
      Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
      Object.defineProperty(el, 'offsetHeight', { configurable: true, value: offsetHeight });
      Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
      el.scrollTop = scrollTop;
      fireEvent.scroll(el);
    }

    function getShadows(container: HTMLElement) {
      const [top, bottom] = container.querySelectorAll<HTMLElement>('div[role="presentation"]');
      return { top, bottom };
    }

    it('shows a shadow on each edge that has rows scrolled out of view', () => {
      const { container } = render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const grid = screen.getByRole('grid');
      const { top, bottom } = getShadows(container);

      // parked at the top of a table taller than its viewport: more rows below, none above
      scrollTo(grid, { scrollTop: 0, clientHeight: 100, scrollHeight: 400 });
      expect(top).toHaveStyle({ opacity: '0' });
      expect(bottom).toHaveStyle({ opacity: '1' });

      // somewhere in the middle: rows hidden both ways
      scrollTo(grid, { scrollTop: 150, clientHeight: 100, scrollHeight: 400 });
      expect(top).toHaveStyle({ opacity: '1' });
      expect(bottom).toHaveStyle({ opacity: '1' });

      // scrolled to the very bottom
      scrollTo(grid, { scrollTop: 300, clientHeight: 100, scrollHeight: 400 });
      expect(top).toHaveStyle({ opacity: '1' });
      expect(bottom).toHaveStyle({ opacity: '0' });
    });

    it('stays hidden when every row already fits', () => {
      const { container } = render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const { top, bottom } = getShadows(container);

      scrollTo(screen.getByRole('grid'), { scrollTop: 0, clientHeight: 400, scrollHeight: 400 });
      expect(top).toHaveStyle({ opacity: '0' });
      expect(bottom).toHaveStyle({ opacity: '0' });
    });

    it('starts the shadows where the scrolling rows do, below the header and above the footer', () => {
      const { container } = render(
        <TableDataGrid
          {...makeProps({ tableRefreshEnabled: true, headerHeight: 36, hasFooter: true, footerHeight: 45 })}
        />
      );
      const { top, bottom } = getShadows(container);

      // the header and footer rows are sticky children of the grid, so a shadow at the grid's own
      // edges would sit on top of them instead of on the rows sliding underneath
      expect(top).toHaveStyle({ top: '36px' });
      expect(bottom).toHaveStyle({ bottom: '45px' });
    });

    it('lifts the bottom shadow clear of a horizontal scrollbar', () => {
      const { container } = render(
        <TableDataGrid {...makeProps({ tableRefreshEnabled: true, hasFooter: true, footerHeight: 45 })} />
      );
      const { bottom } = getShadows(container);

      // the scrollbar sits below the rows and the sticky footer alike, so without clearing it the
      // shadow lands on the scrollbar rather than on the last visible row
      scrollTo(screen.getByRole('grid'), { scrollTop: 0, clientHeight: 100, scrollHeight: 400, offsetHeight: 111 });
      expect(bottom).toHaveStyle({ bottom: '56px' });

      // and drops back down once the columns fit again
      scrollTo(screen.getByRole('grid'), { scrollTop: 0, clientHeight: 100, scrollHeight: 400 });
      expect(bottom).toHaveStyle({ bottom: '45px' });
    });

    it('re-measures after content changes without blocking the render that produced them', () => {
      // expanding a nested row or re-wrapping text after a column resize changes the content height
      // without firing a scroll event or resizing the grid itself
      const props = makeProps({ tableRefreshEnabled: true });
      const { container, rerender } = render(<TableDataGrid {...props} />);
      const grid = screen.getByRole('grid');
      const { bottom } = getShadows(container);

      scrollTo(grid, { scrollTop: 0, clientHeight: 400, scrollHeight: 400 });
      expect(bottom).toHaveStyle({ opacity: '0' });

      Object.defineProperty(grid, 'scrollHeight', { configurable: true, value: 900 });
      rerender(<TableDataGrid {...props} rows={[...props.rows]} />);
      expect(bottom).toHaveStyle({ opacity: '0' });

      act(() => mutationObservers.at(-1)?.callback([], mutationObservers.at(-1) as unknown as MutationObserver));
      act(() => animationFrames.splice(0).forEach((callback) => callback(0)));
      expect(bottom).toHaveStyle({ opacity: '0' });

      act(() => animationFrames.splice(0).forEach((callback) => callback(0)));
      expect(bottom).toHaveStyle({ opacity: '1' });
    });

    it('re-measures when the grid viewport resizes', () => {
      const { container } = render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const grid = screen.getByRole('grid');
      const { bottom } = getShadows(container);

      Object.defineProperties(grid, {
        clientHeight: { configurable: true, value: 100 },
        offsetHeight: { configurable: true, value: 100 },
        scrollHeight: { configurable: true, value: 400 },
      });
      act(() => mutationObservers.at(-1)?.callback([], mutationObservers.at(-1) as unknown as MutationObserver));
      act(() => resizeObservers.at(-1)?.callback([], resizeObservers.at(-1) as unknown as ResizeObserver));

      expect(bottom).toHaveStyle({ opacity: '1' });
      expect(cancelAnimationFrameSpy).toHaveBeenCalledTimes(1);
    });

    it('disconnects its observers and cancels pending work on unmount', () => {
      const { unmount } = render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const scrollShadowObserver = resizeObservers.at(-1);
      const contentObserver = mutationObservers.at(-1);
      act(() => contentObserver?.callback([], contentObserver as unknown as MutationObserver));

      unmount();

      expect(scrollShadowObserver?.disconnect).toHaveBeenCalledTimes(1);
      expect(contentObserver?.disconnect).toHaveBeenCalledTimes(1);
      expect(cancelAnimationFrameSpy).toHaveBeenCalledTimes(1);
    });

    it('is not rendered without table.refresh', () => {
      const { container } = render(<TableDataGrid {...makeProps()} />);
      expect(container.querySelectorAll('div[role="presentation"]')).toHaveLength(0);
    });
  });

  describe('DataGrid prop pass-through', () => {
    it('forwards data-testid to the underlying grid element', () => {
      render(<TableDataGrid {...makeProps({ 'data-testid': 'my-custom-grid' })} />);
      expect(screen.getByTestId('my-custom-grid')).toBeInTheDocument();
    });

    it('forwards aria-label to the underlying grid element', () => {
      render(<TableDataGrid {...makeProps({ 'aria-label': 'accessible grid' })} />);
      expect(screen.getByRole('grid', { name: 'accessible grid' })).toBeInTheDocument();
    });
  });
});
