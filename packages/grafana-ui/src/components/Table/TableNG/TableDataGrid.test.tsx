import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { createTheme, getThemeById, ThemeContext } from '@grafana/data';
import { Cell, type DataGridHandle, Row } from '@grafana/react-data-grid';

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

    it.each([
      { tableRefreshEnabled: true, hasFooter: false, role: 'grid' as const, omitLastBorder: true },
      { tableRefreshEnabled: true, hasFooter: true, role: 'grid' as const, omitLastBorder: false },
      { tableRefreshEnabled: false, hasFooter: false, role: 'grid' as const, omitLastBorder: false },
      { tableRefreshEnabled: true, hasFooter: false, role: 'treegrid' as const, omitLastBorder: false },
    ])(
      'sets the final body border with table.refresh=$tableRefreshEnabled, footer=$hasFooter, role=$role',
      ({ tableRefreshEnabled, hasFooter, role, omitLastBorder }) => {
        const { container } = render(
          <TableDataGrid
            {...makeProps({
              tableRefreshEnabled,
              hasFooter,
              role,
              enableVirtualization: false,
              columns: [{ key: 'value', name: 'Value', renderSummaryCell: () => 'Total' }],
              rows: [
                { __index: 12, __depth: 0, value: 'First' },
                { __index: 3, __depth: 0, value: 'Last' },
              ],
              rowClass: () => 'custom-row',
              renderers: {
                renderRow: (key, props) => <Row key={key} {...props} />,
                renderCell: (key, props) => <Cell key={key} {...props} />,
              },
            })}
          />
        );
        const rows = container.querySelectorAll('.rdg-row:not(.rdg-summary-row)');
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveClass('custom-row');
        expect(rows[1]).toHaveClass('custom-row');
        const firstCell = screen.getByRole('gridcell', { name: 'First' });
        const lastCell = screen.getByRole('gridcell', { name: 'Last' });
        expect(window.getComputedStyle(firstCell).borderBlockEnd).not.toBe('none');
        expect(window.getComputedStyle(lastCell).borderBlockEnd === 'none').toBe(omitLastBorder);
        if (hasFooter) {
          expect(window.getComputedStyle(screen.getByRole('gridcell', { name: 'Total' })).borderBlockEnd).toBe('none');
        }
      }
    );

    it.each([
      [true, 'none'],
      [false, '0 2px 4px red'],
    ])('sets active-cell shadows with table.refresh=%s', (tableRefreshEnabled, expected) => {
      const theme = createTheme({ shadows: { z2: '0 2px 4px red' } });
      render(
        <ThemeContext.Provider value={theme}>
          <TableDataGrid {...makeProps({ tableRefreshEnabled })} />
        </ThemeContext.Provider>
      );
      const gridClasses = Array.from(screen.getByRole('grid').classList);
      const activeCellRules = Array.from(document.styleSheets)
        .flatMap((sheet) => Array.from(sheet.cssRules))
        .filter(
          (rule): rule is CSSStyleRule =>
            rule instanceof CSSStyleRule &&
            gridClasses.some((className) => rule.selectorText.startsWith(`.${className}`)) &&
            rule.selectorText.includes('[aria-selected=true]:focus-within') &&
            rule.selectorText.includes(':hover') &&
            rule.style.getPropertyValue('box-shadow') !== ''
        );

      expect(activeCellRules.map((rule) => rule.style.getPropertyValue('box-shadow'))).toEqual([expected, expected]);
    });
  });

  describe('table theme colors', () => {
    it.each([
      ['dark', '#181b1f', '#111217', '#2c2f35', '#34363a', '#4c4e56'],
      ['light', '#ffffff', '#fbfbfb', '#ececed', '#e0e0e0', '#d4d5d6'],
      ['visual_refresh_dark', '#111419', '#090b0f', '#202429', '#282d33', '#282d33'],
      ['visual_refresh_light', '#ffffff', '#fafafa', '#f0f0ef', '#e4e3e2', '#dddcdb'],
    ])('uses the %s table surfaces in opaque and transparent panels', (id, body, canvas, header, hover, divider) => {
      const theme = getThemeById(id);
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
        components: {
          table: {
            background: '#123456',
            headerBackground: '#234567',
            border: 'hsl(from #345678 h s l)',
            headerBorder: '#456789',
            rowHoverBackgroundSolid: '#56789a',
            rowSelectedBackground: '#6789ab',
            rowSelectedHoverBackground: '#789abc',
            cellSelectionBorder: '#89abcd',
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
      expect(grid.getPropertyValue('--rdg-border-color')).toBe('hsl(from #345678 h s l)');
      expect(grid.getPropertyValue('--rdg-summary-border-color')).toBe('hsl(from #345678 h s l)');
      expect(grid.getPropertyValue('--rdg-row-hover-background-color')).toBe('#56789a');
      expect(grid.getPropertyValue('--rdg-row-selected-background-color')).toBe('#6789ab');
      expect(grid.getPropertyValue('--rdg-row-selected-hover-background-color')).toBe('#789abc');
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

    it('re-measures on render, so content that grows without a scroll or a resize still gets a shadow', () => {
      // expanding a nested row or re-wrapping text after a column resize changes the content height
      // without firing a scroll event or resizing the grid itself
      const { container, rerender } = render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const grid = screen.getByRole('grid');
      const { bottom } = getShadows(container);

      scrollTo(grid, { scrollTop: 0, clientHeight: 400, scrollHeight: 400 });
      expect(bottom).toHaveStyle({ opacity: '0' });

      Object.defineProperty(grid, 'scrollHeight', { configurable: true, value: 900 });
      rerender(<TableDataGrid {...makeProps({ tableRefreshEnabled: true, noValue: 'forces a re-render' })} />);
      expect(bottom).toHaveStyle({ opacity: '1' });
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
