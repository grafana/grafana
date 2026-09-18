import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { colorManipulator, createTheme, getThemeById, ThemeContext } from '@grafana/data';
import { type DataGridHandle, Row, Cell } from '@grafana/react-data-grid';

import { TableDataGrid, type TableDataGridProps } from './TableDataGrid';
import { FIRST_COLUMN_CLASS, LAST_COLUMN_CLASS } from './constants';

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
  const frameClasses = Array.from(screen.getByRole(role).parentElement!.classList);
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule && frameClasses.some((className) => rule.selectorText === `.${className}::after`)
    );
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
    it('clips the grid inside the rounded frame', () => {
      const radius = createTheme().shape.radius.default;
      const { unmount } = render(<TableDataGrid {...makeProps({ tableRefreshEnabled: true })} />);
      const refreshedFrame = window.getComputedStyle(screen.getByRole('grid').parentElement!);
      expect(refreshedFrame.getPropertyValue('border-start-start-radius')).toBe(radius);
      expect(refreshedFrame.getPropertyValue('border-end-start-radius')).toBe(radius);
      expect(refreshedFrame.overflow).toBe('hidden');

      unmount();

      // Classic tables keep their original unframed geometry.
      render(<TableDataGrid {...makeProps()} />);
      const classicFrame = window.getComputedStyle(screen.getByRole('grid').parentElement!);
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
