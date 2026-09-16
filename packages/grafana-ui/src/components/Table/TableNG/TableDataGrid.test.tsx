import { render, screen } from '@testing-library/react';
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

    it('disables the grid tabular-nums until table.refresh, then lets it stand', () => {
      // The beta.61 grid roots `font-variant-numeric: tabular-nums`. It's part of the refreshed
      // experience, so off-toggle we override it back to `normal`; on-toggle we leave the grid's own
      // rule in place (unset here, since the grid's stylesheet isn't loaded in jsdom).
      const { unmount } = render(<TableDataGrid {...makeProps()} />);
      const classic = window.getComputedStyle(screen.getByRole('grid'));
      expect(classic.getPropertyValue('font-variant-numeric')).toBe('normal');

      unmount();

      render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const refreshed = window.getComputedStyle(screen.getByRole('grid'));
      expect(refreshed.getPropertyValue('font-variant-numeric')).toBe('');
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
