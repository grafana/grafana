import { render, screen, waitFor } from '@testing-library/react';
import userEvents from '@testing-library/user-event';

import { createDataFrame } from '@grafana/data';
import { mockBoundingClientRect, mockClientSize } from '@grafana/test-utils';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';
import { textToDataContainer } from '../FlameGraph/testHelpers';
import { ColorScheme } from '../types';

import FlameGraphTopTableContainer, { buildFilteredTable } from './FlameGraphTopTableContainer';

// AutoSizer needs a measurable rect, and react-data-grid additionally sizes its virtualized viewport
// from the client box - jsdom reports 0 for both.
function mockTableSize({ width, height }: { width: number; height: number } = { width: 500, height: 500 }) {
  mockBoundingClientRect({ width, height });
  mockClientSize({ width, height });
}

describe('FlameGraphTopTableContainer', () => {
  const setup = (props?: { useTableNG?: boolean }) => {
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });
    const onSearch = jest.fn();
    const onSandwich = jest.fn();

    const renderResult = render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={onSearch}
        onSandwich={onSandwich}
        colorScheme={ColorScheme.ValueBased}
        useTableNG={props?.useTableNG}
      />
    );

    return { renderResult, mocks: { onSearch, onSandwich } };
  };

  it('should render correctly', async () => {
    mockTableSize();

    setup();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(16);

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(4);
    expect(columnHeaders[1].textContent).toEqual('Symbol');
    expect(columnHeaders[2].textContent).toEqual('Self');
    expect(columnHeaders[3].textContent).toEqual('Total');

    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(60); // 16 rows
    expect(cells[1].textContent).toEqual('net/http.HandlerFunc.ServeHTTP');
    expect(cells[2].textContent).toEqual('31.7 K');
    expect(cells[3].textContent).toEqual('5.58 Bil');
    expect(cells[5].textContent).toEqual('total');
    expect(cells[6].textContent).toEqual('16.5 K');
    expect(cells[7].textContent).toEqual('16.5 Bil');
    expect(cells[25].textContent).toEqual('net/http.(*conn).serve');
    expect(cells[26].textContent).toEqual('5.63 K');
    expect(cells[27].textContent).toEqual('5.63 Bil');
  });

  it('should render search and sandwich buttons', async () => {
    // Needed for AutoSizer to work in test
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 500,
        height: 500,
        left: 0,
      })),
    });

    const { mocks } = setup();

    const searchButtons = screen.getAllByLabelText(/Search for symbol/);
    expect(searchButtons.length > 0).toBeTruthy();
    await userEvents.click(searchButtons[0]);

    expect(mocks.onSearch).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');

    const sandwichButtons = screen.getAllByLabelText(/Show in sandwich view/);
    expect(sandwichButtons.length > 0).toBeTruthy();
    await userEvents.click(sandwichButtons[0]);

    expect(mocks.onSandwich).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');
  });
});

describe('FlameGraphTopTableContainer with useTableNG', () => {
  const setup = (props?: { tableRefreshEnabled?: boolean }) => {
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });
    const onSearch = jest.fn();
    const onSandwich = jest.fn();

    const renderResult = render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={onSearch}
        onSandwich={onSandwich}
        colorScheme={ColorScheme.ValueBased}
        useTableNG={true}
        tableRefreshEnabled={props?.tableRefreshEnabled}
      />
    );

    return { renderResult, mocks: { onSearch, onSandwich } };
  };

  it('should render correctly', async () => {
    mockTableSize();

    setup();

    // Columns: an actions column followed by Symbol / Self / Total.
    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(4);
    // The actions column sets hideHeader: true - its label should be blank, not the literal text "actions".
    expect(columnHeaders[0].textContent).toEqual('');
    expect(columnHeaders[1].textContent).toEqual('Symbol');
    expect(columnHeaders[2].textContent).toEqual('Self');
    expect(columnHeaders[3].textContent).toEqual('Total');

    // Sample rows render with their (unique) symbol names + self/total values. Content-based assertions since
    // react-data-grid's virtualized role="grid" doesn't have the same fixed row/cell counts as TableRT.
    expect(screen.getByText('net/http.HandlerFunc.ServeHTTP')).toBeInTheDocument();
    expect(screen.getByText('net/http.(*conn).serve')).toBeInTheDocument();
    expect(screen.getAllByText('31.7 K').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5.58 Bil').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5.63 K').length).toBeGreaterThan(0);
  });

  // The refreshed header lifts the sort arrow out of the label button so a long title can ellipsize
  // without clipping it. Asserting the arrow's placement is the observable proof that
  // tableRefreshEnabled actually reaches TableNG, since this package can't read the toggle itself.
  it.each([
    { tableRefreshEnabled: undefined, placement: 'inside' },
    { tableRefreshEnabled: true, placement: 'outside' },
  ])(
    'with tableRefreshEnabled=$tableRefreshEnabled renders the sort arrow $placement the header label',
    async ({ tableRefreshEnabled }) => {
      mockTableSize();

      setup({ tableRefreshEnabled });

      // The top table sorts by Self descending by default, so that header owns the arrow.
      const selfHeader = screen.getAllByRole('columnheader')[2];
      const label = selfHeader.querySelector('button');

      expect(selfHeader.querySelectorAll('svg')).toHaveLength(1);
      expect(label!.querySelectorAll('svg')).toHaveLength(tableRefreshEnabled ? 0 : 1);
    }
  );

  it('should render search and sandwich buttons', async () => {
    // Needed for AutoSizer to work in test
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 500,
        height: 500,
        left: 0,
      })),
    });

    const { mocks } = setup();

    const searchButtons = screen.getAllByLabelText(/Search for symbol/);
    expect(searchButtons.length > 0).toBeTruthy();
    await userEvents.click(searchButtons[0]);

    expect(mocks.onSearch).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');

    const sandwichButtons = screen.getAllByLabelText(/Show in sandwich view/);
    expect(sandwichButtons.length > 0).toBeTruthy();
    await userEvents.click(sandwichButtons[0]);

    expect(mocks.onSandwich).toHaveBeenCalledWith('net/http.HandlerFunc.ServeHTTP');
  });

  it('should sort by column header and call onTableSort', async () => {
    mockTableSize();
    const onTableSort = jest.fn();
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });

    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        onTableSort={onTableSort}
        colorScheme={ColorScheme.ValueBased}
        useTableNG={true}
      />
    );

    const totalHeader = screen.getByRole('columnheader', { name: 'Total' });
    await userEvents.click(totalHeader);

    // First click on a column that isn't already sorted sorts ascending.
    expect(onTableSort).toHaveBeenCalledWith('Total_asc');
  });

  it('does not sort when the actions column header is clicked', async () => {
    mockTableSize();
    const onTableSort = jest.fn();
    const flameGraphData = createDataFrame(data);
    const container = new FlameGraphDataContainer(flameGraphData, { collapsing: true });

    render(
      <FlameGraphTopTableContainer
        data={container}
        onSymbolClick={jest.fn()}
        onSearch={jest.fn()}
        onSandwich={jest.fn()}
        onTableSort={onTableSort}
        colorScheme={ColorScheme.ValueBased}
        useTableNG={true}
      />
    );

    // The actions column sets sortable: false and has a blank header (hideHeader), so it's the first
    // columnheader with no accessible name.
    const actionsHeader = screen.getAllByRole('columnheader')[0];
    await userEvents.click(actionsHeader);

    expect(onTableSort).not.toHaveBeenCalled();
  });
});

describe('buildFilteredTable', () => {
  it('should group data by label and sum values', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const result = buildFilteredTable(container!);

    expect(result).toEqual({
      '0': { self: 1, total: 7, totalRight: 0 },
      '1': { self: 0, total: 3, totalRight: 0 },
      '2': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 3, total: 3, totalRight: 0 },
      '4': { self: 3, total: 3, totalRight: 0 },
    });
  });

  it('should sum values for duplicate labels', () => {
    const container = textToDataContainer(`
[0///]
[1][1]
    `);

    const result = buildFilteredTable(container!);

    expect(result).toEqual({
      '0': { self: 0, total: 6, totalRight: 0 },
      '1': { self: 6, total: 6, totalRight: 0 },
    });
  });

  it('should filter by matchedLabels when provided', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set(['1', '3']);
    const result = buildFilteredTable(container!, matchedLabels);

    expect(result).toEqual({
      '1': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 3, total: 3, totalRight: 0 },
    });
  });

  it('should handle empty matchedLabels set', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set<string>();
    const result = buildFilteredTable(container!, matchedLabels);

    expect(result).toEqual({});
  });

  it('should handle data with no matches', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
    `);

    const matchedLabels = new Set(['9']);
    const result = buildFilteredTable(container!, matchedLabels);

    expect(result).toEqual({});
  });

  it('should work without matchedLabels filter', () => {
    const container = textToDataContainer(`
[0]
[1]
    `);

    const result = buildFilteredTable(container!);

    expect(result).toEqual({
      '0': { self: 0, total: 3, totalRight: 0 },
      '1': { self: 3, total: 3, totalRight: 0 },
    });
  });
  it('should not inflate totals for recursive calls', () => {
    const container = textToDataContainer(`
[0////]
[1][2]
[3][4]
[0]
    `);

    const result = buildFilteredTable(container!);

    expect(result).toEqual({
      '0': { self: 4, total: 7, totalRight: 0 },
      '1': { self: 0, total: 3, totalRight: 0 },
      '2': { self: 0, total: 3, totalRight: 0 },
      '3': { self: 0, total: 3, totalRight: 0 },
      '4': { self: 3, total: 3, totalRight: 0 },
    });
  });
});

describe('FlameGraphTopTableContainer column widths with useTableNG', () => {
  const GRID_WIDTH = 500;
  const SCROLLBAR_WIDTH = 11;

  // jsdom does no layout, so the grid's own vertical scrollbar has to be faked: TableNG derives it
  // from offsetWidth - clientWidth on the grid element and lays the columns out inside what is left.
  // Without it the space available to the columns always equals the width the table is handed, and a
  // set of column widths that overflows by exactly the scrollbar looks fine.
  const mockedSizes = [
    { property: 'offsetWidth', target: HTMLElement.prototype, gridValue: GRID_WIDTH },
    { property: 'clientWidth', target: Element.prototype, gridValue: GRID_WIDTH - SCROLLBAR_WIDTH },
  ] as const;

  const originalDescriptors = mockedSizes.map(({ property, target }) => ({
    property,
    target,
    descriptor: Object.getOwnPropertyDescriptor(target, property)!,
  }));

  const mockGridScrollbar = () => {
    for (const { property, target, gridValue } of mockedSizes) {
      Object.defineProperty(target, property, {
        configurable: true,
        get(this: Element) {
          return this.classList.contains('rdg') ? gridValue : 0;
        },
      });
    }
  };

  // jsdom's canvas mock measures every string as zero-width, so content-aware widths would size the
  // symbol column as if it were empty and never overflow the pane. Give text a width proportional to
  // its length so the long Go symbols in the fixture stretch the column the way they do in a browser.
  const CHAR_WIDTH = 8;
  const mockTextMeasurement = () => {
    jest.spyOn(CanvasRenderingContext2D.prototype, 'measureText').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ((text: string) => ({
        width: String(text).length * CHAR_WIDTH,
      })) as typeof CanvasRenderingContext2D.prototype.measureText
    );
  };

  afterEach(() => {
    jest.restoreAllMocks();
    for (const { property, target, descriptor } of originalDescriptors) {
      Object.defineProperty(target, property, descriptor);
    }
  });

  // Symbol is the one column left unsized, so whichever way TableNG sizes its auto columns it must
  // land inside the space the scrollbar leaves — the pane has no room for a horizontal scrollbar.
  it.each([{ contentAwareWidthsEnabled: undefined }, { contentAwareWidthsEnabled: true }])(
    'fits the columns in the space the scrollbar leaves with contentAwareWidthsEnabled=$contentAwareWidthsEnabled',
    async ({ contentAwareWidthsEnabled }) => {
      mockTableSize({ width: GRID_WIDTH, height: GRID_WIDTH });
      mockGridScrollbar();
      mockTextMeasurement();

      const container = new FlameGraphDataContainer(createDataFrame(data), { collapsing: true });
      render(
        <FlameGraphTopTableContainer
          data={container}
          onSymbolClick={jest.fn()}
          onSearch={jest.fn()}
          onSandwich={jest.fn()}
          colorScheme={ColorScheme.ValueBased}
          useTableNG={true}
          contentAwareWidthsEnabled={contentAwareWidthsEnabled}
        />
      );

      await waitFor(() => {
        const grid = document.querySelector<HTMLElement>('.rdg')!;
        // The wrapper the TableNG branch sizes, i.e. the width the table was handed.
        const handedWidth = parseFloat(grid.parentElement!.style.width);
        const columnWidths = grid.style.gridTemplateColumns.split(' ').map(parseFloat);

        expect(columnWidths).toHaveLength(4);
        expect(columnWidths.reduce((total, columnWidth) => total + columnWidth, 0)).toBe(handedWidth - SCROLLBAR_WIDTH);
      });
    }
  );
});
