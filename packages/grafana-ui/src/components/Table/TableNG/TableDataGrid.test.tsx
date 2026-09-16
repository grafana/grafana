import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { createTheme, getThemeById, ThemeContext } from '@grafana/data';
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

  describe('table theme colors', () => {
    it.each([
      ['dark', '#181b1f', '#111217', '#2c2f35', '#34363a', '#383b42'],
      ['light', '#ffffff', '#fbfbfb', '#ececed', '#e0e0e0', '#e1e2e3'],
      ['visual_refresh_dark', '#111419', '#090b0f', '#202429', '#282d33', '#282d33'],
      ['visual_refresh_light', '#ffffff', '#fafafa', '#f0f0ef', '#e4e3e2', '#dddcdb'],
    ])('uses the %s table surfaces in opaque and transparent panels', (id, body, canvas, header, hover, divider) => {
      const theme = getThemeById(id);
      theme.flags.visualDesignRefresh = id.startsWith('visual_refresh');
      const props = makeProps({ tableRefreshEnabled: true, columns: [{ key: 'value', name: 'Value' }] });
      const { rerender } = render(
        <ThemeContext.Provider value={theme}>
          <TableDataGrid {...props} />
        </ThemeContext.Provider>
      );
      const grid = window.getComputedStyle(screen.getByRole('grid'));
      expect(grid.getPropertyValue('--rdg-background-color')).toBe(body);
      expect(grid.getPropertyValue('--rdg-row-background-color')).toBe(body);
      expect(grid.getPropertyValue('--rdg-header-background-color')).toBe(header);
      expect(grid.getPropertyValue('--rdg-row-hover-background-color')).toBe(hover);
      expect(window.getComputedStyle(screen.getByRole('row')).getPropertyValue('--rdg-border-color')).toBe(divider);

      rerender(
        <ThemeContext.Provider value={theme}>
          <TableDataGrid {...props} transparent />
        </ThemeContext.Provider>
      );
      const transparentGrid = window.getComputedStyle(screen.getByRole('grid'));
      expect(transparentGrid.getPropertyValue('--rdg-background-color')).toBe(canvas);
      expect(transparentGrid.getPropertyValue('--rdg-row-background-color')).toBe(canvas);
      expect(transparentGrid.getPropertyValue('--rdg-header-background-color')).toBe(header);
      expect(transparentGrid.getPropertyValue('--rdg-row-hover-background-color')).toBe(hover);
    });

    it.each([false, true])('honors table overrides with visualDesignRefresh=%s', (visualDesignRefresh) => {
      const theme = createTheme({
        colors: {
          mode: 'dark',
          background: { primary: '#123456' },
          secondary: { shade: '#456789' },
          action: { selectedBorder: '#89abcd' },
        },
        components: {
          panel: { background: '#123456' },
          table: {
            headerBackground: '#234567',
            border: '#345678',
            rowHoverBackground: '#56789a',
            rowSelectedBackground: '#6789ab',
          },
        },
      });
      theme.flags.visualDesignRefresh = visualDesignRefresh;
      render(
        <ThemeContext.Provider value={theme}>
          <TableDataGrid {...makeProps({ tableRefreshEnabled: true, columns: [{ key: 'value', name: 'Value' }] })} />
        </ThemeContext.Provider>
      );
      const grid = window.getComputedStyle(screen.getByRole('grid'));
      expect(grid.getPropertyValue('--rdg-background-color')).toBe('#123456');
      expect(grid.getPropertyValue('--rdg-header-background-color')).toBe('#234567');
      expect(grid.getPropertyValue('--rdg-border-color')).toBe('#345678');
      expect(grid.getPropertyValue('--rdg-summary-border-color')).toBe('#345678');
      expect(grid.getPropertyValue('--rdg-row-hover-background-color')).toBe('#56789a');
      expect(grid.getPropertyValue('--rdg-row-selected-background-color')).toBe('#6789ab');
      expect(grid.getPropertyValue('--rdg-row-selected-hover-background-color')).toBe(
        theme.colors.emphasize('#6789ab', 0.05)
      );
      expect(grid.getPropertyValue('--rdg-selection-color')).toBe('#89abcd');
      expect(window.getComputedStyle(screen.getByRole('row')).getPropertyValue('--rdg-border-color')).toBe('#456789');
    });

    it('keeps the header on the body surface when table.refresh is disabled', () => {
      render(
        <ThemeContext.Provider value={getThemeById('visual_refresh_dark')}>
          <TableDataGrid {...makeProps()} />
        </ThemeContext.Provider>
      );
      const grid = window.getComputedStyle(screen.getByRole('grid'));
      expect(grid.getPropertyValue('--rdg-header-background-color')).toBe('#111419');
      expect(grid.getPropertyValue('--rdg-row-hover-background-color')).toBe('#282d33');
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
