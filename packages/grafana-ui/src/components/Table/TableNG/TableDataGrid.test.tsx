import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { colorManipulator, createTheme, getThemeById, ThemeContext } from '@grafana/data';
import { type DataGridHandle, Row, Cell } from '@grafana/react-data-grid';

import { TableDataGrid, type TableDataGridProps } from './TableDataGrid';
import { FIRST_COLUMN_CLASS, LAST_COLUMN_CLASS } from './constants';

// jsdom does not compute pseudo-element styles; read the matching Emotion rules in cascade order.
function shadowStyle(element: HTMLElement | null, edge: 'before' | 'after', property: string) {
  let value = '';
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (
        rule instanceof CSSStyleRule &&
        rule.selectorText.split(',').some((selector) => {
          return Array.from(element?.classList ?? []).some((className) => selector.trim() === `.${className}::${edge}`);
        })
      ) {
        value = rule.style.getPropertyValue(property) || value;
      }
    }
  }
  return value;
}

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
    getRowHeight: () => 36,
    height: 100,
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

function getGridFrameOverlayStyleRule(role: 'grid' | 'treegrid' = 'grid') {
  const frameClasses = Array.from(screen.getByRole(role).parentElement!.parentElement!.classList);
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule && frameClasses.some((className) => rule.selectorText === `.${className}::after`)
    );
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
    it('clips the grid inside the rounded frame', () => {
      const radius = createTheme().shape.radius.default;
      const { unmount } = render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const refreshedFrame = window.getComputedStyle(screen.getByRole('grid').parentElement!.parentElement!);
      expect(refreshedFrame.getPropertyValue('border-start-start-radius')).toBe(radius);
      expect(refreshedFrame.getPropertyValue('border-end-start-radius')).toBe(radius);
      expect(refreshedFrame.overflow).toBe('hidden');

      unmount();

      // Classic tables keep their original unframed geometry.
      render(<TableDataGrid {...makeProps()} />);
      const classicFrame = window.getComputedStyle(screen.getByRole('grid').parentElement!.parentElement!);
      expect(classicFrame.getPropertyValue('border-start-start-radius')).toBe('');
      expect(classicFrame.getPropertyValue('border-end-start-radius')).toBe('');
      expect(classicFrame.overflow).toBe('');
    });

    it.each([
      {
        tableRefreshEnabled: true,
        hasFooter: false,
        noPanelPadding: false,
        role: 'grid' as const,
        height: 110,
        omitLastBorder: true,
      },
      {
        tableRefreshEnabled: false,
        hasFooter: false,
        noPanelPadding: false,
        role: 'grid' as const,
        omitLastBorder: false,
      },
      {
        tableRefreshEnabled: false,
        hasFooter: true,
        noPanelPadding: false,
        role: 'grid' as const,
        omitLastBorder: false,
      },
      {
        tableRefreshEnabled: true,
        hasFooter: false,
        noPanelPadding: false,
        role: 'grid' as const,
        height: 111,
        omitLastBorder: false,
      },
      {
        tableRefreshEnabled: false,
        hasFooter: false,
        noPanelPadding: true,
        role: 'grid' as const,
        omitLastBorder: false,
      },
      {
        tableRefreshEnabled: true,
        hasFooter: false,
        noPanelPadding: false,
        role: 'treegrid' as const,
        omitLastBorder: true,
      },
      {
        tableRefreshEnabled: true,
        hasFooter: false,
        noPanelPadding: false,
        role: 'treegrid' as const,
        height: 111,
        omitLastBorder: false,
      },
    ])(
      'sets the final body border with table.refresh=$tableRefreshEnabled, footer=$hasFooter, noPanelPadding=$noPanelPadding, role=$role',
      ({ tableRefreshEnabled, hasFooter, noPanelPadding, role, height, omitLastBorder }) => {
        const theme = createTheme();
        const { container } = render(
          <TableDataGrid
            {...makeProps({
              tableRefreshEnabled,
              hasFooter,
              noPanelPadding,
              role,
              height: height ?? 100,
              enableVirtualization: false,
              columns: [
                {
                  key: 'value',
                  name: 'Value',
                  renderSummaryCell: () => 'Total',
                },
              ],
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
          expect(
            window.getComputedStyle(screen.getByRole('gridcell', { name: 'Total' })).borderBlockEnd === 'none'
          ).toBe(tableRefreshEnabled);
        }
        if (tableRefreshEnabled && !noPanelPadding) {
          const frameRule = getGridFrameOverlayStyleRule(role);
          expect(frameRule?.style.getPropertyValue('border')).toBe(`1px solid ${theme.components.table.border}`);
          expect(frameRule?.style.getPropertyValue('inset')).toBe('0');
          expect(frameRule?.style.getPropertyValue('border-start-start-radius')).toBe(theme.shape.radius.default);
          expect(frameRule?.style.getPropertyValue('border-end-start-radius')).toBe(theme.shape.radius.default);
          expect(frameRule?.style.getPropertyValue('border-end-end-radius')).toBe(theme.shape.radius.default);
        } else {
          expect(getGridFrameOverlayStyleRule(role)).toBeUndefined();
        }
      }
    );

    it('keeps selected first and last column edges visible inside the frame', () => {
      render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);

      const gridClasses = Array.from(screen.getByRole('grid').classList);
      const edgeRules = Array.from(document.styleSheets)
        .flatMap((sheet) => Array.from(sheet.cssRules))
        .filter(
          (rule): rule is CSSStyleRule =>
            rule instanceof CSSStyleRule &&
            gridClasses.some((className) => rule.selectorText.startsWith(`.${className}`)) &&
            rule.selectorText.includes('[aria-selected="true"]:focus-within') &&
            [FIRST_COLUMN_CLASS, LAST_COLUMN_CLASS].some((className) => rule.selectorText.includes(`.${className}`))
        );

      expect(edgeRules).toHaveLength(2);
      expect(edgeRules.map((rule) => rule.style.getPropertyValue('background-color'))).toEqual([
        'var(--rdg-selection-color)',
        'var(--rdg-selection-color)',
      ]);
      expect(edgeRules.map((rule) => rule.style.getPropertyValue('inset-inline-start'))).toContain('1px');
      expect(edgeRules.map((rule) => rule.style.getPropertyValue('inset-inline-end'))).toContain('1px');
    });

    it('renders the refreshed outer border unless the table is flush with its panel', () => {
      const theme = createTheme();
      const props = makeProps({ tableRefreshEnabled: true });
      const { rerender } = render(<TableDataGrid {...props} />);

      expect(getGridFrameOverlayStyleRule()?.style.getPropertyValue('border')).toBe(
        `1px solid ${theme.components.table.border}`
      );

      rerender(<TableDataGrid {...props} noPanelPadding />);

      expect(getGridFrameOverlayStyleRule()).toBeUndefined();
    });

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

  describe('layout', () => {
    it('lets its wrapper shrink below the content height', () => {
      // The multi-frame panel stacks the frame picker under the table in a flex column. The grid
      // itself could always shrink because it scrolls; the wrapper around it does not, so without
      // an explicit minimum of 0 its flex base size is the whole content height and whatever sits
      // below the table gets pushed out of the panel.
      const { container } = render(<TableDataGrid {...makeProps()} />);
      expect(screen.getByRole('grid').parentElement).toHaveStyle({ 'min-block-size': '0' });
      expect(container.firstElementChild).toHaveStyle({ position: 'relative', 'min-block-size': '0' });
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
      expect(shadowStyle(wrapper, 'before', 'opacity')).toBe('0');
      expect(shadowStyle(wrapper, 'after', 'opacity')).toBe('1');

      // somewhere in the middle: rows hidden both ways
      scrollTo(grid, { scrollTop: 150, clientHeight: 100, scrollHeight: 400 });
      expect(shadowStyle(wrapper, 'before', 'opacity')).toBe('1');
      expect(shadowStyle(wrapper, 'after', 'opacity')).toBe('1');

      // scrolled to the very bottom
      scrollTo(grid, { scrollTop: 300, clientHeight: 100, scrollHeight: 400 });
      expect(shadowStyle(wrapper, 'before', 'opacity')).toBe('1');
      expect(shadowStyle(wrapper, 'after', 'opacity')).toBe('0');
      expect(onScroll).toHaveBeenCalledTimes(3);
    });

    it('keeps visible shadows colored for the current theme after switching themes', () => {
      const props = makeProps({ tableRefreshEnabled: true });
      const { rerender } = render(
        <ThemeContext.Provider value={createTheme({ colors: { mode: 'dark' } })}>
          <TableDataGrid {...props} />
        </ThemeContext.Provider>
      );
      const grid = screen.getByRole('grid');
      scrollTo(grid, { scrollTop: 150, clientHeight: 100, scrollHeight: 400 });
      for (const mode of ['light', 'dark'] as const) {
        rerender(
          <ThemeContext.Provider value={createTheme({ colors: { mode } })}>
            <TableDataGrid {...props} />
          </ThemeContext.Provider>
        );
        const color = mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)';
        expect(shadowStyle(grid.parentElement, 'before', 'background')).toBe(
          `linear-gradient(0deg, transparent, ${color})`
        );
        expect(shadowStyle(grid.parentElement, 'after', 'background')).toBe(
          `linear-gradient(180deg, transparent, ${color})`
        );
        expect(shadowStyle(grid.parentElement, 'before', 'opacity')).toBe('1');
        expect(shadowStyle(grid.parentElement, 'after', 'opacity')).toBe('1');
      }
    });

    it('stays hidden when every row already fits', () => {
      render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const wrapper = screen.getByRole('grid').parentElement;

      scrollTo(screen.getByRole('grid'), { scrollTop: 0, clientHeight: 400, scrollHeight: 400 });
      expect(shadowStyle(wrapper, 'before', 'opacity')).toBe('0');
      expect(shadowStyle(wrapper, 'after', 'opacity')).toBe('0');
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
      expect(shadowStyle(wrapper, 'before', 'top')).toBe('36px');
      expect(shadowStyle(wrapper, 'after', 'bottom')).toBe('45px');
    });

    it('lifts the bottom shadow clear of a horizontal scrollbar', () => {
      render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true, hasFooter: true, footerHeight: 45 })} />);
      const wrapper = screen.getByRole('grid').parentElement;

      // the scrollbar sits below the rows and the sticky footer alike, so without clearing it the
      // shadow lands on the scrollbar rather than on the last visible row
      scrollTo(screen.getByRole('grid'), { scrollTop: 0, clientHeight: 100, scrollHeight: 400, offsetHeight: 111 });
      expect(shadowStyle(wrapper, 'after', 'bottom')).toBe('56px');

      // and drops back down once the columns fit again
      scrollTo(screen.getByRole('grid'), { scrollTop: 0, clientHeight: 100, scrollHeight: 400 });
      expect(shadowStyle(wrapper, 'after', 'bottom')).toBe('45px');
    });

    it('re-measures after rendered content changes', () => {
      // expanding a nested row or re-wrapping text after a column resize changes the content height
      // without firing a scroll event or resizing the grid itself
      const props = makeProps({ tableRefreshEnabled: true });
      const { rerender } = render(<TableDataGrid {...props} />);
      const grid = screen.getByRole('grid');
      const wrapper = screen.getByRole('grid').parentElement;

      scrollTo(grid, { scrollTop: 0, clientHeight: 400, scrollHeight: 400 });
      expect(shadowStyle(wrapper, 'after', 'opacity')).toBe('0');

      Object.defineProperty(grid, 'scrollHeight', { configurable: true, value: 900 });
      rerender(<TableDataGrid {...props} rows={[...props.rows]} />);
      expect(shadowStyle(wrapper, 'after', 'opacity')).toBe('1');
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

      expect(shadowStyle(wrapper, 'after', 'opacity')).toBe('1');
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
      expect(shadowStyle(grid.parentElement, 'before', 'content')).toBe('');
      expect(shadowStyle(grid.parentElement, 'after', 'content')).toBe('');
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
        expect(getGridFrameOverlayStyleRule()?.style.getPropertyValue('border')).toBe(
          `1px solid ${theme.components.table.border}`
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
        expect(getGridFrameOverlayStyleRule()?.style.getPropertyValue('border')).toBe(
          `1px solid ${theme.components.table.border}`
        );
        expect(getGridFrameOverlayStyleRule()?.style.getPropertyValue('border-start-start-radius')).toBe(
          theme.shape.radius.default
        );
        expect(getGridFrameOverlayStyleRule()?.style.getPropertyValue('border-end-start-radius')).toBe(
          theme.shape.radius.default
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
