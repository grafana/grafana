import { fireEvent, render, screen } from '@testing-library/react';
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

  beforeEach(() => {
    origResizeObserver = global.ResizeObserver;
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    global.ResizeObserver = origResizeObserver;
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

  describe('scroll shadows', () => {
    // jsdom has no layout, so the grid reports every scroll metric as 0. Fake the viewport the hook
    // reads, then fire the scroll it would have listened to.
    function scrollTo(el: HTMLElement, { scrollTop, clientHeight, scrollHeight }: Record<string, number>) {
      Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
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
