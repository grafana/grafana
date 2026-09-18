import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { colorManipulator, createTheme, getThemeById, ThemeContext } from '@grafana/data';
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

function getRegisteredTheme(id: string) {
  const theme = getThemeById(id);
  return {
    ...theme,
    flags: { ...theme.flags, visualDesignRefresh: id.startsWith('visual_refresh') },
  };
}

function readTableSurfaces() {
  const grid = window.getComputedStyle(screen.getByRole('grid'));
  return {
    background: grid.getPropertyValue('--rdg-background-color'),
    header: grid.getPropertyValue('--rdg-header-background-color'),
    hover: grid.getPropertyValue('--rdg-row-hover-background-color'),
    border: grid.getPropertyValue('--rdg-border-color'),
  };
}

describe('TableDataGrid', () => {
  let origResizeObserver = global.ResizeObserver;
  let resizeObservers: Array<{
    callback: ResizeObserverCallback;
    disconnect: jest.Mock;
  }>;

  beforeEach(() => {
    origResizeObserver = global.ResizeObserver;
    resizeObservers = [];
    global.ResizeObserver = class ResizeObserver {
      disconnect = jest.fn();

      constructor(public callback: ResizeObserverCallback) {
        resizeObservers.push(this);
      }

      observe() {}
      unobserve() {}
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

    it('shows a shadow on each edge that has rows scrolled out of view', () => {
      const onScroll = jest.fn();
      render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true, onScroll })} />);
      const grid = screen.getByRole('grid');
      const wrapper = screen.getByRole('grid').parentElement;

      // parked at the top of a table taller than its viewport: more rows below, none above
      scrollTo(grid, { scrollTop: 0, clientHeight: 100, scrollHeight: 400 });
      expect(wrapper).not.toHaveClass('table-scroll-shadow-top');
      expect(wrapper).toHaveClass('table-scroll-shadow-bottom');

      // somewhere in the middle: rows hidden both ways
      scrollTo(grid, { scrollTop: 150, clientHeight: 100, scrollHeight: 400 });
      expect(wrapper).toHaveClass('table-scroll-shadow-top');
      expect(wrapper).toHaveClass('table-scroll-shadow-bottom');

      // scrolled to the very bottom
      scrollTo(grid, { scrollTop: 300, clientHeight: 100, scrollHeight: 400 });
      expect(wrapper).toHaveClass('table-scroll-shadow-top');
      expect(wrapper).not.toHaveClass('table-scroll-shadow-bottom');
      expect(onScroll).toHaveBeenCalledTimes(3);
    });

    it('stays hidden when every row already fits', () => {
      render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const wrapper = screen.getByRole('grid').parentElement;

      scrollTo(screen.getByRole('grid'), { scrollTop: 0, clientHeight: 400, scrollHeight: 400 });
      expect(wrapper).not.toHaveClass('table-scroll-shadow-top');
      expect(wrapper).not.toHaveClass('table-scroll-shadow-bottom');
    });

    it('starts the shadows where the scrolling rows do, below the header and above the footer', () => {
      render(
        <TableDataGrid
          {...makeProps({ tableRefreshEnabled: true, headerHeight: 36, hasFooter: true, footerHeight: 45 })}
        />
      );
      const wrapper = screen.getByRole('grid').parentElement;

      // the header and footer rows are sticky children of the grid, so a shadow at the grid's own
      // edges would sit on top of them instead of on the rows sliding underneath
      expect(wrapper).toHaveStyle({ '--table-scroll-shadow-top': '36px' });
      expect(wrapper).toHaveStyle({ '--table-scroll-shadow-bottom': '45px' });
    });

    it('lifts the bottom shadow clear of a horizontal scrollbar', () => {
      render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true, hasFooter: true, footerHeight: 45 })} />);
      const wrapper = screen.getByRole('grid').parentElement;

      // the scrollbar sits below the rows and the sticky footer alike, so without clearing it the
      // shadow lands on the scrollbar rather than on the last visible row
      scrollTo(screen.getByRole('grid'), { scrollTop: 0, clientHeight: 100, scrollHeight: 400, offsetHeight: 111 });
      expect(wrapper).toHaveStyle({ '--table-scroll-shadow-bottom': '56px' });

      // and drops back down once the columns fit again
      scrollTo(screen.getByRole('grid'), { scrollTop: 0, clientHeight: 100, scrollHeight: 400 });
      expect(wrapper).toHaveStyle({ '--table-scroll-shadow-bottom': '45px' });
    });

    it('re-measures after rendered content changes', () => {
      // expanding a nested row or re-wrapping text after a column resize changes the content height
      // without firing a scroll event or resizing the grid itself
      const props = makeProps({ tableRefreshEnabled: true });
      const { rerender } = render(<TableDataGrid {...props} />);
      const grid = screen.getByRole('grid');
      const wrapper = screen.getByRole('grid').parentElement;

      scrollTo(grid, { scrollTop: 0, clientHeight: 400, scrollHeight: 400 });
      expect(wrapper).not.toHaveClass('table-scroll-shadow-bottom');

      Object.defineProperty(grid, 'scrollHeight', { configurable: true, value: 900 });
      rerender(<TableDataGrid {...props} rows={[...props.rows]} />);
      expect(wrapper).toHaveClass('table-scroll-shadow-bottom');
    });

    it('re-measures when the grid viewport resizes', () => {
      render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const grid = screen.getByRole('grid');
      const wrapper = screen.getByRole('grid').parentElement;

      Object.defineProperties(grid, {
        clientHeight: { configurable: true, value: 100 },
        offsetHeight: { configurable: true, value: 100 },
        scrollHeight: { configurable: true, value: 400 },
      });
      act(() => resizeObservers.at(-1)?.callback([], resizeObservers.at(-1) as unknown as ResizeObserver));

      expect(wrapper).toHaveClass('table-scroll-shadow-bottom');
    });

    it('disconnects its resize observer on unmount', () => {
      const { unmount } = render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const scrollShadowObserver = resizeObservers.at(-1);

      unmount();

      expect(scrollShadowObserver?.disconnect).toHaveBeenCalledTimes(1);
    });

    it('does not enable shadows without table.refresh', () => {
      const onScroll = jest.fn();
      render(<TableDataGrid {...makeProps({ onScroll })} />);
      const grid = screen.getByRole('grid');

      scrollTo(grid, { scrollTop: 150, clientHeight: 100, scrollHeight: 400 });

      expect(onScroll).toHaveBeenCalledTimes(1);
      expect(grid.parentElement).not.toHaveClass('table-scroll-shadow-top', 'table-scroll-shadow-bottom');
    });
  });

  describe('table theme colors', () => {
    it.each(['dark', 'light', 'visual_refresh_dark', 'visual_refresh_light'])(
      'uses the %s table surfaces in opaque and transparent panels',
      (id) => {
        const theme = getRegisteredTheme(id);
        const body = theme.components.panel.background;
        const transparentBody = theme.flags.visualDesignRefresh
          ? theme.colors.background.page
          : theme.colors.background.canvas;
        const headerDivider = colorManipulator
          .onBackground(theme.colors.secondary.shade, theme.components.table.headerBackground)
          .toHexString();
        const props = makeProps({ tableRefreshEnabled: true, columns: [{ key: 'value', name: 'Value' }] });
        const { rerender } = render(
          <ThemeContext.Provider value={theme}>
            <TableDataGrid {...props} />
          </ThemeContext.Provider>
        );
        const grid = window.getComputedStyle(screen.getByRole('grid'));
        expect(grid.getPropertyValue('--rdg-background-color')).toBe(body);
        expect(grid.getPropertyValue('--rdg-row-background-color')).toBe(body);
        expect(grid.getPropertyValue('--rdg-header-background-color')).toBe(theme.components.table.headerBackground);
        expect(grid.getPropertyValue('--rdg-row-hover-background-color')).toBe(
          theme.components.table.rowHoverBackground
        );
        expect(window.getComputedStyle(screen.getByRole('row')).getPropertyValue('--rdg-border-color')).toBe(
          headerDivider
        );

        rerender(
          <ThemeContext.Provider value={theme}>
            <TableDataGrid {...props} transparent />
          </ThemeContext.Provider>
        );
        const transparentGrid = window.getComputedStyle(screen.getByRole('grid'));
        expect(transparentGrid.getPropertyValue('--rdg-background-color')).toBe(transparentBody);
        expect(transparentGrid.getPropertyValue('--rdg-row-background-color')).toBe(transparentBody);
        expect(transparentGrid.getPropertyValue('--rdg-header-background-color')).toBe(
          theme.components.table.headerBackground
        );
        expect(transparentGrid.getPropertyValue('--rdg-row-hover-background-color')).toBe(
          theme.components.table.rowHoverBackground
        );
      }
    );

    it.each([
      ['dark', 'visual_refresh_dark'],
      ['light', 'visual_refresh_light'],
    ])('renders distinct table surfaces for %s and %s', (classicId, refreshedId) => {
      const props = makeProps({ tableRefreshEnabled: true, columns: [{ key: 'value', name: 'Value' }] });
      const { rerender } = render(
        <ThemeContext.Provider value={getRegisteredTheme(classicId)}>
          <TableDataGrid {...props} />
        </ThemeContext.Provider>
      );
      const classicSurfaces = readTableSurfaces();

      rerender(
        <ThemeContext.Provider value={getRegisteredTheme(refreshedId)}>
          <TableDataGrid {...props} />
        </ThemeContext.Provider>
      );

      expect(readTableSurfaces()).not.toEqual(classicSurfaces);
    });

    it.each([false, true])('honors table overrides with visualDesignRefresh=%s', (visualDesignRefresh) => {
      const customColors = {
        panel: '#123456',
        header: '#234567',
        border: '#345678',
        headerDivider: '#456789',
        hover: '#56789a',
        selected: '#6789ab',
        selection: '#89abcd',
      };
      const baseTheme = createTheme({
        colors: {
          mode: 'dark',
          background: { primary: customColors.panel },
          secondary: { shade: customColors.headerDivider },
          action: { selectedBorder: customColors.selection },
        },
        components: {
          panel: { background: customColors.panel },
          table: {
            headerBackground: customColors.header,
            border: customColors.border,
            rowHoverBackground: customColors.hover,
            rowSelectedBackground: customColors.selected,
          },
        },
      });
      const theme = { ...baseTheme, flags: { ...baseTheme.flags, visualDesignRefresh } };
      render(
        <ThemeContext.Provider value={theme}>
          <TableDataGrid {...makeProps({ tableRefreshEnabled: true, columns: [{ key: 'value', name: 'Value' }] })} />
        </ThemeContext.Provider>
      );
      const grid = window.getComputedStyle(screen.getByRole('grid'));
      expect(grid.getPropertyValue('--rdg-background-color')).toBe(customColors.panel);
      expect(grid.getPropertyValue('--rdg-header-background-color')).toBe(customColors.header);
      expect(grid.getPropertyValue('--rdg-border-color')).toBe(customColors.border);
      expect(grid.getPropertyValue('--rdg-summary-border-color')).toBe(customColors.border);
      expect(grid.getPropertyValue('--rdg-row-hover-background-color')).toBe(customColors.hover);
      expect(grid.getPropertyValue('--rdg-row-selected-background-color')).toBe(customColors.selected);
      expect(grid.getPropertyValue('--rdg-row-selected-hover-background-color')).toBe(
        theme.colors.emphasize(customColors.selected, 0.05)
      );
      expect(grid.getPropertyValue('--rdg-selection-color')).toBe(customColors.selection);
      expect(window.getComputedStyle(screen.getByRole('row')).getPropertyValue('--rdg-border-color')).toBe(
        customColors.headerDivider
      );
    });

    it('keeps the header on the body surface when table.refresh is disabled', () => {
      const theme = getRegisteredTheme('visual_refresh_dark');
      render(
        <ThemeContext.Provider value={theme}>
          <TableDataGrid {...makeProps()} />
        </ThemeContext.Provider>
      );
      const grid = window.getComputedStyle(screen.getByRole('grid'));
      expect(grid.getPropertyValue('--rdg-header-background-color')).toBe(theme.components.panel.background);
      expect(grid.getPropertyValue('--rdg-row-hover-background-color')).toBe(theme.components.table.rowHoverBackground);
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
